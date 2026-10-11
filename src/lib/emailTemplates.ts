import 'server-only'
import { db } from '@/lib/db'
import { emailTemplates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { absoluteUrl, SITE_URL } from '@/lib/site'
import {
  EMAIL_LOGO_PATH, emailButton, emailCode, emailDivider, emailDocument, emailEyebrow, emailHeading, emailParagraph,
} from '@/lib/emailLayout'

export const NEWSLETTER_WELCOME_KEY = 'newsletter_welcome'
/** Mail z prośbą o potwierdzenie zapisu (double opt-in) — wysyłany jako pierwszy. */
export const NEWSLETTER_CONFIRM_KEY = 'newsletter_confirm'
export const EMAIL_TEMPLATE_KEYS = [NEWSLETTER_CONFIRM_KEY, NEWSLETTER_WELCOME_KEY] as const
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number]

export interface EmailTemplate {
  subject: string
  html:    string
}

// Domyślne szablony newslettera — używane, dopóki nie zostaną zmienione
// w panelu admina (/admin/marketing → „Domyślny” wczytuje je do edytora).
// Wygląd wspólny z mailami o zamówieniach: `lib/emailLayout.ts`.
//
// Placeholdery: {{email}} (adres subskrybenta), {{shopUrl}} (adres sklepu),
// {{logoUrl}} (logo HAU w PNG), {{confirmUrl}} (link potwierdzający),
// {{unsubscribeUrl}} (link wypisania). Kod rabatowy musi istnieć
// w /admin/discounts (NEWSLETTER10 zakłada migracja drizzle/0002_discount_codes.sql).
const TEMPLATE_URLS = { shopUrl: '{{shopUrl}}', logoUrl: '{{logoUrl}}' }

export const DEFAULT_NEWSLETTER_WELCOME: EmailTemplate = {
  subject: 'Witaj w HAU — Twój kod -10% na pierwsze zamówienie 🐾',
  html: emailDocument({
    ...TEMPLATE_URLS,
    title: 'Witaj w HAU',
    preheader: 'Dziękujemy za potwierdzenie zapisu. Na start: -10% na pierwsze zamówienie.',
    body: [
      emailEyebrow('Witamy w HAU'),
      emailHeading('Miło nam, że jesteś z nami'),
      emailParagraph(
        'Dziękujemy za potwierdzenie zapisu. Od teraz jako pierwszy dowiesz się o nowościach, promocjach i nowych poradnikach dla opiekunów psów — bez zasypywania skrzynki.',
        { margin: '0 0 28px' },
      ),
      emailCode('NEWSLETTER10', 'Twój kod na pierwsze zamówienie', '-10% na wszystkie produkty'),
      emailParagraph(
        'Wpisz kod w koszyku, w polu <strong style="color:#1b1b1b;font-weight:600;">„Masz kod promocyjny?”</strong>. Kod można wykorzystać raz.',
        { size: 14, margin: '0 0 28px' },
      ),
      emailButton('{{shopUrl}}', 'Przejdź do sklepu'),
    ].join('\n'),
    footer:
      'Otrzymujesz tę wiadomość, ponieważ adres {{email}} został zapisany do newslettera HAU i zapis został potwierdzony.<br>' +
      '<a href="{{unsubscribeUrl}}" style="color:#8a8a8a;text-decoration:underline;">Wypisz się z newslettera</a>',
  }),
}

export const DEFAULT_NEWSLETTER_CONFIRM: EmailTemplate = {
  subject: 'Potwierdź zapis do newslettera HAU',
  html: emailDocument({
    ...TEMPLATE_URLS,
    title: 'Potwierdź zapis do newslettera',
    preheader: 'Jedno kliknięcie i gotowe — po potwierdzeniu wyślemy Ci kod -10%.',
    body: [
      emailEyebrow('Newsletter'),
      emailHeading('Potwierdź swój zapis'),
      emailParagraph(
        'Dziękujemy za zainteresowanie newsletterem HAU. Kliknij przycisk poniżej, aby potwierdzić, że adres <strong style="color:#1b1b1b;font-weight:600;">{{email}}</strong> należy do Ciebie.',
        { margin: '0 0 28px' },
      ),
      emailButton('{{confirmUrl}}', 'Potwierdzam zapis'),
      emailParagraph('Zaraz po potwierdzeniu wyślemy Ci kod -10% na pierwsze zamówienie.', { size: 14, muted: true, margin: '20px 0 0' }),
      emailDivider(),
      emailParagraph(
        'Jeśli to nie Ty zapisałeś ten adres, po prostu zignoruj tę wiadomość — bez potwierdzenia nie wyślemy Ci niczego.',
        { size: 13, muted: true, margin: '0 0 12px' },
      ),
      emailParagraph(
        'Przycisk nie działa? Skopiuj ten adres do przeglądarki:<br><a href="{{confirmUrl}}" style="color:#1f7f6e;word-break:break-all;">{{confirmUrl}}</a>',
        { size: 13, muted: true, margin: '0' },
      ),
    ].join('\n'),
  }),
}

/*
 * Odciski (sha256, 32 znaki) WCZEŚNIEJSZYCH domyślnych szablonów. Szablon
 * zapisany w panelu bez zmian (np. ktoś kliknął „Zapisz” na domyślnym) nie
 * powinien blokować nowego wyglądu — taki zapis traktujemy jak brak zapisu.
 * Szablony zmienione ręcznie zostają nietknięte.
 */
const LEGACY_DEFAULT_HTML = new Set([
  '02bf905a2b7d3c929aa8b67ad3df678e', // powitalny (double opt-in, 2026-10)
  '8172c02789ee292b6ddfe994ed97c33d', // powitalny (przed double opt-in)
  '78b01a909aa89ba1c9d3701f3f35d0e1', // powitalny (pierwsza wersja)
  '36ab2218e30fb9b94a477c73baa7f2cb', // „Potwierdź zapis” (2026-10)
])

const LEGACY_DEFAULT_SUBJECTS = new Set([
  'Witaj w społeczności e-hau.pl — Twój kod -10% 🐾',
  'Potwierdź zapis do newslettera e-hau.pl 🐾',
])

function isLegacyDefaultHtml(html: string): boolean {
  const digest = createHash('sha256').update(html.replace(/\r\n/g, '\n').trim()).digest('hex').slice(0, 32)
  return LEGACY_DEFAULT_HTML.has(digest)
}

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateKey, EmailTemplate> = {
  [NEWSLETTER_CONFIRM_KEY]: DEFAULT_NEWSLETTER_CONFIRM,
  [NEWSLETTER_WELCOME_KEY]: DEFAULT_NEWSLETTER_WELCOME,
}

export function isEmailTemplateKey(key: string): key is EmailTemplateKey {
  return (EMAIL_TEMPLATE_KEYS as readonly string[]).includes(key)
}

// Pobiera szablon z bazy; jeśli nie istnieje — zwraca domyślny.
export async function getEmailTemplate(key: string): Promise<EmailTemplate> {
  const fallback = isEmailTemplateKey(key) ? DEFAULT_EMAIL_TEMPLATES[key] : { subject: '', html: '' }
  const rows = await db
    .select({ subject: emailTemplates.subject, html: emailTemplates.html })
    .from(emailTemplates)
    .where(eq(emailTemplates.key, key))
    .limit(1)

  if (!rows[0]) return fallback

  // Niezmieniony stary domyślny szablon → nowy domyślny (wygląd z logo).
  const legacyHtml = !rows[0].html || isLegacyDefaultHtml(rows[0].html)
  const legacySubject = !rows[0].subject || (legacyHtml && LEGACY_DEFAULT_SUBJECTS.has(rows[0].subject))
  return {
    subject: legacySubject ? fallback.subject : rows[0].subject,
    html:    legacyHtml ? fallback.html : rows[0].html,
  }
}

// Zapisuje/aktualizuje szablon w bazie (upsert).
export async function setEmailTemplate(
  key: string,
  template: EmailTemplate
): Promise<void> {
  await db
    .insert(emailTemplates)
    .values({
      key,
      subject: template.subject,
      html:    template.html,
    })
    .onDuplicateKeyUpdate({
      set: {
        subject: template.subject,
        html:    template.html,
      },
    })
}

// Podmienia placeholdery {{email}}, {{shopUrl}}, {{logoUrl}} oraz dodatkowe (np.
// {{confirmUrl}}, {{unsubscribeUrl}}) w treści i temacie. Wartości trafiające
// do HTML-a są escapowane.
export function renderTemplate(
  template: EmailTemplate,
  email: string,
  extra: Record<string, string> = {},
): EmailTemplate {
  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
  const vars: Record<string, string> = {
    email,
    shopUrl: SITE_URL,
    logoUrl: absoluteUrl(EMAIL_LOGO_PATH),
    unsubscribeUrl: SITE_URL,
    ...extra,
  }
  let subject = template.subject
  let html = template.html
  for (const [name, value] of Object.entries(vars)) {
    subject = subject.replaceAll(`{{${name}}}`, value)
    html = html.replaceAll(`{{${name}}}`, escapeHtml(value))
  }
  return { subject, html }
}
