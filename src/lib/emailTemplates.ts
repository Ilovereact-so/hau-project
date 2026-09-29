import 'server-only'
import { db } from '@/lib/db'
import { emailTemplates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { SITE_URL } from '@/lib/site'

export const NEWSLETTER_WELCOME_KEY = 'newsletter_welcome'

export interface EmailTemplate {
  subject: string
  html:    string
}

// Domyślny szablon maila powitalnego — używany, dopóki nie zostanie zmieniony
// w panelu admina (/admin/marketing → „Domyślny” wczytuje go do edytora).
// Placeholdery: {{email}} (adres subskrybenta), {{shopUrl}} (adres sklepu).
//
// HTML mailowy, nie stronowy: układ na tabelach i style inline (Outlook nie
// zna flex/grid, Gmail wycina <style>), logo tekstowe (Gmail nie pokazuje SVG),
// szerokość 600 px. Kod rabatowy musi istnieć w /admin/discounts
// (NEWSLETTER10 zakłada migracja drizzle/0002_discount_codes.sql).
export const DEFAULT_NEWSLETTER_WELCOME: EmailTemplate = {
  subject: 'Witaj w społeczności e-hau.pl — Twój kod -10% 🐾',
  html: `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Witaj w społeczności e-hau.pl!</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f2;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f4f4f2;">Dziękujemy za zapis. Na start mamy dla Ciebie 10% rabatu na pierwsze zamówienie.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f2;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;font-family:'Poppins',Helvetica,Arial,sans-serif;color:#20201f;">
        <tr>
          <td style="padding:0 8px 20px;font-size:22px;font-weight:700;letter-spacing:3px;color:#20201f;">HAU</td>
        </tr>
        <tr>
          <td style="background:#ffffff;border:1px solid #e8e8e8;border-radius:24px;padding:40px 40px 36px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#e2f3f0;border-radius:999px;padding:6px 14px;font-size:12px;font-weight:600;color:#3f8f84;letter-spacing:0.3px;">Newsletter</td>
              </tr>
            </table>
            <h1 style="margin:20px 0 12px;font-size:26px;line-height:1.25;font-weight:600;color:#20201f;">Witaj w społeczności e-hau.pl!</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#4a4a4a;">
              Cieszymy się, że jesteś z nami. Od teraz jako pierwszy dowiesz się o nowościach, promocjach i poradnikach dla opiekunów psów — bez zasypywania skrzynki.
            </p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7faf9;border:1px dashed #6eb0a6;border-radius:18px;">
              <tr>
                <td align="center" style="padding:24px 20px;">
                  <p style="margin:0 0 6px;font-size:13px;color:#6c6c6c;">Twój kod na pierwsze zamówienie</p>
                  <p style="margin:0;font-size:28px;font-weight:700;letter-spacing:4px;color:#20201f;font-family:'Courier New',Courier,monospace;">NEWSLETTER10</p>
                  <p style="margin:8px 0 0;font-size:14px;font-weight:600;color:#3f8f84;">-10% na produkty</p>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 28px;font-size:14px;line-height:1.6;color:#6c6c6c;">
              Wpisz kod w koszyku w polu <strong style="color:#20201f;">„Masz kod promocyjny?”</strong>. Kod działa raz na konto.
            </p>

            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#20201f;border-radius:999px;">
                  <a href="{{shopUrl}}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Przejdź do sklepu</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 16px 0;font-size:12px;line-height:1.6;color:#8e8e8e;text-align:center;">
            Otrzymujesz tę wiadomość, ponieważ adres {{email}} został zapisany do newslettera e-hau.pl i wyrażono zgodę na jego otrzymywanie.
            Jeśli to pomyłka lub chcesz się wypisać — odpowiedz na tę wiadomość.<br>
            <a href="{{shopUrl}}" style="color:#8e8e8e;">e-hau.pl</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`,
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

// Podmienia placeholdery {{email}} i {{shopUrl}} w treści i temacie.
// Adres e-mail jest escapowany — trafia do HTML-a.
export function renderTemplate(template: EmailTemplate, email: string): EmailTemplate {
  const safeEmail = email.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
  return {
    subject: template.subject.replaceAll('{{email}}', email).replaceAll('{{shopUrl}}', SITE_URL),
    html:    template.html.replaceAll('{{email}}', safeEmail).replaceAll('{{shopUrl}}', SITE_URL),
  }
}
