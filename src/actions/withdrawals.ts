'use server'

import { randomUUID } from 'crypto'
import { auth } from '@clerk/nextjs/server'
import { headers } from 'next/headers'
import { and, eq, like, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { orderWithdrawals, orders, shippingAddresses } from '@/db/schema'
import { MAIL_FROM, sendMail } from '@/lib/mail'
import { RETURN_COST_NOTE, SELLER, absoluteUrl } from '@/lib/site'
import {
  EMAIL_LOGO_PATH, emailButton, emailDetails, emailDocument, emailHeading, emailNote, emailParagraph,
  emailSectionTitle, escapeHtml as escape,
} from '@/lib/emailLayout'
import {
  normalizeWithdrawal, validateWithdrawal, type WithdrawalErrors, type WithdrawalInput,
} from '@/lib/withdrawals'

/*
 * Złożenie oświadczenia o odstąpieniu od umowy (formularz /help/odstapienie-od-umowy).
 *
 * Oświadczenie przyjmujemy ZAWSZE, gdy formularz jest poprawnie wypełniony —
 * także gdy numer zamówienia nie pasuje do bazy (literówka nie może odebrać
 * konsumentowi prawa). Dopasowane zamówienie trafia do `order_id`, a sklep
 * dostaje powiadomienie z informacją, czy dopasowanie się udało.
 */

export type WithdrawalResult =
  | { ok: true; submittedAt: string; matched: boolean }
  | { ok: false; error: string; fieldErrors?: WithdrawalErrors }

const IP_WINDOW_SECONDS = 60 * 60
const IP_LIMIT = 10

const dateTime = (date: Date) =>
  new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'long',
    timeStyle: 'medium',
    timeZone: 'Europe/Warsaw',
  }).format(date)

async function findOrder(input: WithdrawalInput): Promise<string | null> {
  if (!/^[0-9A-F-]{4,36}$/.test(input.orderNumber)) return null
  const prefix = input.orderNumber.toLowerCase()
  const rows = await db
    .select({ id: orders.id, guestEmail: orders.guestEmail, addressEmail: shippingAddresses.email })
    .from(orders)
    .leftJoin(shippingAddresses, eq(shippingAddresses.orderId, orders.id))
    .where(and(
      like(orders.id, `${prefix}%`),
      // E-mail porównujemy bez wielkości liter (input jest już małymi literami).
      or(sql`lower(${orders.guestEmail}) = ${input.email}`, sql`lower(${shippingAddresses.email}) = ${input.email}`),
    ))
    .limit(2)
  // Dwa trafienia na ten sam prefiks i e-mail są praktycznie niemożliwe,
  // ale wtedy nie zgadujemy — sklep dopasuje ręcznie.
  return rows.length === 1 ? rows[0].id : null
}

/** Treść oświadczenia: dane (zamówienie, data) + szary panel z tekstem — ta sama dla klienta i sklepu. */
function statementHtml(input: WithdrawalInput, submittedAt: Date) {
  const text =
    `Ja, ${escape(input.name)}, niniejszym informuję o moim odstąpieniu od umowy sprzedaży ` +
    (input.items ? `następujących rzeczy: ${escape(input.items)}` : 'wszystkich rzeczy z zamówienia') +
    ` (zamówienie #${escape(input.orderNumber)}).` +
    (input.note ? `<br><br>Uwagi: ${escape(input.note)}` : '') +
    `<br><span style="color:#6c6c6c;">Adres e-mail konsumenta: ${escape(input.email)}</span>`
  return emailDetails([
    { label: 'Zamówienie', value: `#${escape(input.orderNumber)}` },
    { label: 'Złożono', value: escape(dateTime(submittedAt)) },
  ]) + emailNote(text)
}

async function sendConfirmations(input: WithdrawalInput, submittedAt: Date, matchedOrderId: string | null) {
  const shop = { shopUrl: absoluteUrl('/').replace(/\/$/, ''), logoUrl: absoluteUrl(EMAIL_LOGO_PATH) }
  const statement = statementHtml(input, submittedAt)
  const seller = SELLER.name ? `${escape(SELLER.name)}${SELLER.address ? `, ${escape(SELLER.address)}` : ''}` : 'sklep HAU'
  const meta = `Zamówienie #${escape(input.orderNumber)}`

  // 1) Potwierdzenie dla konsumenta — trwały nośnik z treścią i datą złożenia.
  const customerHtml = emailDocument({
    ...shop,
    title: 'Potwierdzenie odstąpienia od umowy',
    preheader: `Otrzymaliśmy Twoje oświadczenie o odstąpieniu od umowy (zamówienie #${escape(input.orderNumber)}).`,
    meta,
    body: [
      emailHeading('Otrzymaliśmy Twoje oświadczenie'),
      emailParagraph(`Potwierdzamy, że ${seller} otrzymał poniższe oświadczenie o odstąpieniu od umowy. Zachowaj tę wiadomość — to potwierdzenie jego złożenia.`, { margin: '0 0 28px' }),
      statement,
      emailSectionTitle('Co dalej'),
      emailParagraph(
        'Odeślij produkty w ciągu 14 dni od złożenia oświadczenia — zasady i adres zwrotu znajdziesz w zakładce „Zwroty i reklamacje”. ' +
          'Zwrot płatności otrzymasz w ciągu 14 dni od otrzymania oświadczenia; możemy go wstrzymać do chwili otrzymania produktów albo dowodu ich odesłania. ' +
          RETURN_COST_NOTE,
        { size: 14 },
      ),
      emailButton(absoluteUrl('/help/zwroty-i-reklamacje'), 'Zwroty i reklamacje', { secondary: true }),
    ].join('\n'),
    footer: 'Masz pytania? Odpowiedz na tę wiadomość — chętnie pomożemy.',
  })

  // 2) Powiadomienie dla sklepu.
  const shopHtml = emailDocument({
    ...shop,
    title: 'Nowe odstąpienie od umowy',
    preheader: `Odstąpienie od umowy — zamówienie #${escape(input.orderNumber)}`,
    meta: 'Powiadomienie sklepu',
    body: [
      emailHeading('Klient odstąpił od umowy'),
      matchedOrderId
        ? emailParagraph('Zamówienie dopasowane automatycznie (numer i e-mail zgodne).', { muted: true, size: 14 })
        : emailNote('Numer lub e-mail nie pasują do żadnego zamówienia. Sprawdź ręcznie — oświadczenie i tak jest skuteczne.', { title: 'Nie udało się dopasować zamówienia', tone: 'amber' }),
      statement,
      matchedOrderId ? emailButton(absoluteUrl(`/admin/orders/${matchedOrderId}`), 'Otwórz zamówienie w panelu') : '',
    ].filter(Boolean).join('\n'),
    footer: 'Wiadomość wysłana automatycznie przez formularz odstąpienia od umowy.',
  })

  const shopAddress = SELLER.email || MAIL_FROM
  const results = await Promise.allSettled([
    sendMail({ to: input.email, subject: `Potwierdzenie odstąpienia od umowy — zamówienie #${input.orderNumber}`, html: customerHtml }),
    sendMail({ to: shopAddress, subject: `Odstąpienie od umowy — zamówienie #${input.orderNumber}`, html: shopHtml }),
  ])
  for (const result of results) {
    if (result.status === 'rejected') console.error('[withdrawals] mail failed', result.reason)
    else if (!result.value) console.warn('[withdrawals] mail not sent — SMTP not configured')
  }
}

export async function submitWithdrawal(raw: Partial<Record<keyof WithdrawalInput, unknown>>): Promise<WithdrawalResult> {
  const input = normalizeWithdrawal(raw ?? {})
  const fieldErrors = validateWithdrawal(input)
  if (Object.keys(fieldErrors).length) {
    return { ok: false, error: 'Uzupełnij wymagane pola.', fieldErrors }
  }

  // Limit nadużyć — formularz jest publiczny i wysyła maile.
  try {
    const ip = ((await headers()).get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
    const key = `withdrawals:submit:v1:${ip}`
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, IP_WINDOW_SECONDS)
    if (count > IP_LIMIT) {
      return { ok: false, error: 'Za dużo prób z tego adresu. Spróbuj za godzinę albo napisz do nas mailem — oświadczenie wysłane mailem też jest ważne.' }
    }
  } catch (error) {
    // Awaria Redisa nie może zablokować złożenia oświadczenia.
    console.error('[withdrawals] rate limit check failed', error)
  }

  const { userId } = await auth()
  const submittedAt = new Date()
  let matchedOrderId: string | null = null
  try {
    matchedOrderId = await findOrder(input)
    await db.insert(orderWithdrawals).values({
      id: randomUUID(),
      orderId: matchedOrderId,
      orderNumber: input.orderNumber,
      name: input.name,
      email: input.email,
      items: input.items || null,
      note: input.note || null,
      userId: userId ?? null,
      createdAt: submittedAt,
    })
  } catch (error) {
    console.error('[withdrawals] save failed', error)
    return {
      ok: false,
      error: `Nie udało się zapisać oświadczenia. Spróbuj ponownie za chwilę${SELLER.email ? ` albo wyślij je mailem na ${SELLER.email}` : ''}.`,
    }
  }

  try {
    await sendConfirmations(input, submittedAt, matchedOrderId)
  } catch (error) {
    // Oświadczenie jest zapisane — brak maila tylko logujemy.
    console.error('[withdrawals] confirmations failed', error)
  }

  return { ok: true, submittedAt: submittedAt.toISOString(), matched: Boolean(matchedOrderId) }
}
