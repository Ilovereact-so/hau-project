// src/actions/newsletter.ts
'use server'

import { db } from '@/lib/db'
import { newsletterSubscribers } from '@/db/schema'
import { sendMail } from '@/lib/mail'
import {
  NEWSLETTER_WELCOME_KEY,
  getEmailTemplate,
  renderTemplate,
} from '@/lib/emailTemplates'
import { eq, sql } from 'drizzle-orm'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface SubscribeNewsletterInput {
  email:   string
  consent: boolean
}

export type SubscribeNewsletterResult =
  // mailSent: czy mail powitalny z kodem faktycznie wyszedł (front mówi prawdę
  // zamiast zawsze obiecywać „kod już leci”).
  | { ok: true; alreadySubscribed: boolean; mailSent: boolean }
  | { ok: false; error: string }

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

  const unsubToken = crypto.randomUUID()

  const [existing] = await db
    .select({ isActive: newsletterSubscribers.isActive })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email))
    .limit(1)
  const alreadySubscribed = !!existing?.isActive

  // Upsert: ponowny zapis tego samego e-maila nie tworzy duplikatu —
  // reaktywuje subskrypcję, odświeża zgodę i zachowuje dotychczasowy token.
  // Wzorzec onDuplicateKeyUpdate jak w src/actions/sync.ts.
  await db
    .insert(newsletterSubscribers)
    .values({
      id:         crypto.randomUUID(),
      email,
      consent:    true,
      isActive:   true,
      unsubToken,
    })
    .onDuplicateKeyUpdate({
      set: {
        consent:    true,
        consentAt:  sql`CURRENT_TIMESTAMP`,
        isActive:   true,
      },
    })

  // Wysłanie maila powitalnego — treść z bazy (edytowalna w panelu admina)
  // z fallbackiem na domyślny szablon. Błąd wysyłki NIE cofa zapisu
  // subskrybenta — subskrypcja jest już potwierdzona.
  const template = renderTemplate(
    await getEmailTemplate(NEWSLETTER_WELCOME_KEY),
    email
  )

  let mailSent = false
  try {
    mailSent = await sendMail({
      to:      email,
      subject: template.subject,
      html:    template.html,
    })
  } catch (err) {
    console.error('❌ Newsletter — błąd wysyłki maila powitalnego:', err)
  }

  return { ok: true, alreadySubscribed, mailSent }
}