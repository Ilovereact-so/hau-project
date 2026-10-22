// src/actions/newsletter.ts
'use server'

import { randomBytes } from 'crypto'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { newsletterSubscribers } from '@/db/schema'
import { sendMail } from '@/lib/mail'
import { redis } from '@/lib/redis'
import { absoluteUrl } from '@/lib/site'
import {
  NEWSLETTER_CONFIRM_KEY,
  NEWSLETTER_WELCOME_KEY,
  getEmailTemplate,
  renderTemplate,
} from '@/lib/emailTemplates'
import { eq, sql } from 'drizzle-orm'
import { skipPendingForSubscriber } from '@/lib/campaigns/campaigns.server'

/*
 * Newsletter z potwierdzeniem zapisu (double opt-in):
 *
 *  1. Formularz → `subscribeToNewsletter`: zapis jako NIEAKTYWNY + mail
 *     „Potwierdź zapis” z jednorazowym linkiem (/newsletter/potwierdz?token=…).
 *  2. Klik w link → strona z przyciskiem „Potwierdzam” → `confirmNewsletter`:
 *     subskrypcja aktywna (`confirmed_at`), mail powitalny z kodem rabatowym.
 *     Przycisk (a nie samo wejście w link) chroni przed automatycznym
 *     „klikaniem” linków przez skanery poczty.
 *  3. Każdy mail powitalny ma link wypisania (/newsletter/wypisz?token=…).
 *
 * Szablony obu maili edytuje się w panelu: Marketing → Newsletter.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TOKEN_RE = /^[a-f0-9]{48}$/
/** Ponowny mail z potwierdzeniem najwcześniej po 2 minutach (ochrona przed spamowaniem cudzej skrzynki). */
const RESEND_AFTER_MS = 2 * 60_000
/** Link potwierdzający jest ważny 7 dni. */
const CONFIRM_TTL_MS = 7 * 24 * 60 * 60_000
/** Limit zapisów z jednego adresu IP. */
const IP_LIMIT = 10
const IP_WINDOW_SECONDS = 60 * 60

const newToken = () => randomBytes(24).toString('hex')

export interface SubscribeNewsletterInput {
  email:   string
  consent: boolean
}

export type SubscribeNewsletterResult =
  // status: `pending` — wysłaliśmy (albo wysłaliśmy niedawno) mail z potwierdzeniem,
  //         `already` — adres jest już aktywnym subskrybentem.
  // mailSent: czy mail faktycznie wyszedł (front mówi prawdę zamiast obiecywać).
  | { ok: true; status: 'pending' | 'already'; mailSent: boolean }
  | { ok: false; error: string }

async function rateLimited(): Promise<boolean> {
  try {
    const ip = ((await headers()).get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
    const key = `newsletter:subscribe:v1:${ip}`
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, IP_WINDOW_SECONDS)
    return count > IP_LIMIT
  } catch {
    return false // Redis niedostępny — nie blokujemy zapisu
  }
}

export async function subscribeToNewsletter(
  input: SubscribeNewsletterInput
): Promise<SubscribeNewsletterResult> {
  const email = (input.email ?? '').trim().toLowerCase()

  if (!email) {
    return { ok: false, error: 'Podaj adres e-mail.' }
  }
  if (email.length > 256 || !EMAIL_RE.test(email)) {
    return { ok: false, error: 'Podaj prawidłowy adres e-mail.' }
  }
  if (!input.consent) {
    return { ok: false, error: 'Zgoda na otrzymywanie newslettera jest wymagana.' }
  }
  if (await rateLimited()) {
    return { ok: false, error: 'Zbyt wiele prób zapisu. Spróbuj ponownie za godzinę.' }
  }

  const [existing] = await db
    .select({
      isActive: newsletterSubscribers.isActive,
      confirmedAt: newsletterSubscribers.confirmedAt,
      confirmSentAt: newsletterSubscribers.confirmSentAt,
    })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email))
    .limit(1)

  if (existing?.isActive && existing.confirmedAt) {
    return { ok: true, status: 'already', mailSent: false }
  }
  if (existing?.confirmSentAt && Date.now() - new Date(existing.confirmSentAt).getTime() < RESEND_AFTER_MS) {
    // Mail z potwierdzeniem wyszedł przed chwilą — nie wysyłamy kolejnego.
    return { ok: true, status: 'pending', mailSent: true }
  }

  const confirmToken = newToken()
  const now = new Date()

  // Upsert: ponowny zapis nie tworzy duplikatu, tylko wystawia nowy link
  // potwierdzający (stary przestaje działać). Zgoda z formularza jest
  // zapisywana od razu (RODO: data i treść zgody), ale subskrypcja zostaje
  // nieaktywna do potwierdzenia.
  await db
    .insert(newsletterSubscribers)
    .values({
      id:            crypto.randomUUID(),
      email,
      consent:       true,
      isActive:      false,
      unsubToken:    newToken(),
      confirmToken,
      confirmSentAt: now,
    })
    .onDuplicateKeyUpdate({
      set: {
        consent:       true,
        consentAt:     sql`CURRENT_TIMESTAMP`,
        confirmToken,
        confirmSentAt: now,
      },
    })

  const template = renderTemplate(await getEmailTemplate(NEWSLETTER_CONFIRM_KEY), email, {
    confirmUrl: absoluteUrl(`/newsletter/potwierdz?token=${confirmToken}`),
  })

  let mailSent = false
  try {
    mailSent = await sendMail({ to: email, subject: template.subject, html: template.html })
  } catch (err) {
    console.error('❌ Newsletter — błąd wysyłki maila z potwierdzeniem:', err)
  }
  // Mail nie wyszedł — „Wyślij ponownie” nie może trafić na blokadę 2 minut.
  if (!mailSent) {
    await db.update(newsletterSubscribers).set({ confirmSentAt: null }).where(eq(newsletterSubscribers.email, email))
  }

  return { ok: true, status: 'pending', mailSent }
}

export type ConfirmNewsletterResult =
  | { ok: true; email: string; alreadyConfirmed: boolean; mailSent: boolean }
  | { ok: false; error: string }

/** Kliknięcie „Potwierdzam zapis” na stronie z linku. */
export async function confirmNewsletter(token: string): Promise<ConfirmNewsletterResult> {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) {
    return { ok: false, error: 'Link potwierdzający jest nieprawidłowy.' }
  }

  const [subscriber] = await db
    .select({
      id: newsletterSubscribers.id,
      email: newsletterSubscribers.email,
      isActive: newsletterSubscribers.isActive,
      confirmedAt: newsletterSubscribers.confirmedAt,
      confirmSentAt: newsletterSubscribers.confirmSentAt,
      unsubToken: newsletterSubscribers.unsubToken,
    })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.confirmToken, token))
    .limit(1)

  if (!subscriber) {
    return { ok: false, error: 'Ten link wygasł albo został już użyty. Zapisz się ponownie w stopce sklepu.' }
  }
  if (subscriber.confirmSentAt && Date.now() - new Date(subscriber.confirmSentAt).getTime() > CONFIRM_TTL_MS) {
    return { ok: false, error: 'Link potwierdzający wygasł (jest ważny 7 dni). Zapisz się ponownie w stopce sklepu.' }
  }

  const alreadyConfirmed = Boolean(subscriber.isActive && subscriber.confirmedAt)
  const unsubToken = subscriber.unsubToken || newToken()

  await db
    .update(newsletterSubscribers)
    .set({
      isActive: true,
      confirmedAt: subscriber.confirmedAt ?? new Date(),
      confirmToken: null,
      unsubToken,
    })
    .where(eq(newsletterSubscribers.id, subscriber.id))

  if (alreadyConfirmed) return { ok: true, email: subscriber.email, alreadyConfirmed, mailSent: false }

  // Mail powitalny z kodem — dopiero po potwierdzeniu. Błąd wysyłki NIE cofa
  // potwierdzenia (subskrypcja jest ważna).
  const template = renderTemplate(await getEmailTemplate(NEWSLETTER_WELCOME_KEY), subscriber.email, {
    unsubscribeUrl: absoluteUrl(`/newsletter/wypisz?token=${unsubToken}`),
  })
  let mailSent = false
  try {
    mailSent = await sendMail({ to: subscriber.email, subject: template.subject, html: template.html })
  } catch (err) {
    console.error('❌ Newsletter — błąd wysyłki maila powitalnego:', err)
  }
  return { ok: true, email: subscriber.email, alreadyConfirmed: false, mailSent }
}

export type UnsubscribeResult = { ok: true; email: string } | { ok: false; error: string }

/** Wypisanie się linkiem z maila (bez logowania). Historia zgody zostaje. */
export async function unsubscribeNewsletter(token: string): Promise<UnsubscribeResult> {
  if (typeof token !== 'string' || !/^[a-f0-9-]{32,64}$/i.test(token)) {
    return { ok: false, error: 'Link wypisania jest nieprawidłowy.' }
  }
  const [subscriber] = await db
    .select({ id: newsletterSubscribers.id, email: newsletterSubscribers.email })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.unsubToken, token))
    .limit(1)
  if (!subscriber) return { ok: false, error: 'Nie znaleźliśmy subskrypcji dla tego linku.' }
  await db.update(newsletterSubscribers).set({ isActive: false }).where(eq(newsletterSubscribers.id, subscriber.id))
  // Trwająca kampania nie wyśle już maila do tej osoby.
  await skipPendingForSubscriber(subscriber.id).catch((err) => console.error('[newsletter] skip pending', err))
  return { ok: true, email: subscriber.email }
}
