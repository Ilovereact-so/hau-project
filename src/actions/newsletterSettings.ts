// src/actions/newsletterSettings.ts
'use server'

import { auth } from '@clerk/nextjs/server'
import {
  NEWSLETTER_WELCOME_KEY,
  getEmailTemplate,
  setEmailTemplate,
  type EmailTemplate,
} from '@/lib/emailTemplates'

const MAX_SUBJECT = 256
const MAX_HTML = 100_000

export type NewsletterSettingsResult =
  | { ok: true }
  | { ok: false; error: string }

// Serwerowy helper — może być wywołany tylko przez admina.
async function requireAdmin(): Promise<string | null> {
  const { userId, sessionClaims } = await auth()
  if (!userId) return 'Brak uprawnień — zaloguj się.'
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') return 'Brak uprawnień — rola inna niż admin.'
  return null
}

export async function getNewsletterWelcomeTemplate(): Promise<{
  subject: string
  html:    string
}> {
  // Odczyt też tylko dla admina (rzucany błąd → formularz pokaże toast).
  const denied = await requireAdmin()
  if (denied) throw new Error(denied)

  return getEmailTemplate(NEWSLETTER_WELCOME_KEY)
}

export async function updateNewsletterWelcomeTemplate(
  template: EmailTemplate
): Promise<NewsletterSettingsResult> {
  const denied = await requireAdmin()
  if (denied) return { ok: false, error: denied }

  const subject = (template?.subject ?? '').trim()
  const html = (template?.html ?? '').trim()

  if (!subject)  return { ok: false, error: 'Temat (subject) nie może być pusty.' }
  if (subject.length > MAX_SUBJECT) return { ok: false, error: `Temat może mieć max ${MAX_SUBJECT} znaków.` }
  if (!html)     return { ok: false, error: 'Treść maila (HTML) nie może być pusta.' }
  if (html.length > MAX_HTML) return { ok: false, error: `Treść może mieć max ${MAX_HTML} znaków.` }

  await setEmailTemplate(NEWSLETTER_WELCOME_KEY, { subject, html })

  return { ok: true }
}