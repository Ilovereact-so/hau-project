import 'server-only'
import { db } from '@/lib/db'
import { emailTemplates } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const NEWSLETTER_WELCOME_KEY = 'newsletter_welcome'

export interface EmailTemplate {
  subject: string
  html:    string
}

// Domyślny szablon maila powitalnego — używany, dopóki nie zostanie zmieniony
// w panelu admina (/admin/newsletter). Może zawierać placeholder {{email}},
// podmieniany na adres subskrybenta podczas wysyłki.
export const DEFAULT_NEWSLETTER_WELCOME: EmailTemplate = {
  subject: 'Witaj w Hau! Odbierz swój kod -10% 🐾',
  html: `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a;">
      <h1 style="color:#1a1a1a;">Witaj w Hafie! 🐾</h1>
      <p>Cześć <strong>{{email}}</strong>!</p>
      <p>Dziękujemy za zapis do naszego newslettera.</p>
      <p>W ramach powitania przygotowaliśmy dla Ciebie <strong>10% rabatu</strong> na pierwsze zakupy:</p>
      <p style="text-align:center;margin:32px 0;">
        <span style="display:inline-block;background:#6eb0a6;color:#fff;font-size:20px;font-weight:bold;padding:14px 28px;border-radius:12px;letter-spacing:2px;">NEWSLETTER10</span>
      </p>
      <p>Wpisz kod w koszyku przy składaniu zamówienia.</p>
      <p style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#888;">
        Otrzymujesz tę wiadomość, ponieważ zapisałeś się do newslettera sklepu Hau i wyraziłeś na to zgodę.
      </p>
    </div>
  `,
}

// Pobiera szablon z bazy; jeśli nie istnieje — zwraca domyślny.
export async function getEmailTemplate(key: string): Promise<EmailTemplate> {
  const rows = await db
    .select({ subject: emailTemplates.subject, html: emailTemplates.html })
    .from(emailTemplates)
    .where(eq(emailTemplates.key, key))
    .limit(1)

  if (!rows[0]) {
    return key === NEWSLETTER_WELCOME_KEY
      ? DEFAULT_NEWSLETTER_WELCOME
      : { subject: '', html: '' }
  }

  return {
    subject: rows[0].subject || DEFAULT_NEWSLETTER_WELCOME.subject,
    html:    rows[0].html || DEFAULT_NEWSLETTER_WELCOME.html,
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

// Podmienia placeholder {{email}} w treści i temacie.
export function renderTemplate(template: EmailTemplate, email: string): EmailTemplate {
  return {
    subject: template.subject.replaceAll('{{email}}', email),
    html:    template.html.replaceAll('{{email}}', email),
  }
}