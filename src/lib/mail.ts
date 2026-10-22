import 'server-only'
import nodemailer from 'nodemailer'

type Transporter = ReturnType<typeof nodemailer.createTransport>

// Pojedynczy transport SMTP, cachowany na globalThis w dev, żeby HMR
// (Turbopack/webpack) nie tworzył nowego transportu przy każdym przeładowaniu
// modułu — analogicznie jak pool MySQL w src/lib/db.ts i redis w src/lib/redis.ts.
const globalForMail = globalThis as unknown as { smtpTransporter?: Transporter }

const SMTP_HOST = process.env.SMTP_HOST?.trim()
const SMTP_PORT = Number(process.env.SMTP_PORT || 587)
const SMTP_SECURE = SMTP_PORT === 465
const SMTP_USER = process.env.SMTP_USER?.trim()
const SMTP_PASS = process.env.SMTP_PASS

const hasSmtpConfig = !!(SMTP_HOST && (SMTP_PORT > 0))

export const smtpTransporter = globalForMail.smtpTransporter
  ?? (hasSmtpConfig
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
      })
    : null)

if (process.env.NODE_ENV !== 'production') {
  globalForMail.smtpTransporter = smtpTransporter ?? undefined
}

// Domyślny nadawca — SMTP_FROM z env, w dev fallback na czytelny adres.
export const MAIL_FROM = process.env.SMTP_FROM?.trim() || (SMTP_USER || 'no-reply@hau.local')

export interface SendMailOptions {
  to:      string
  subject: string
  html:    string
  /** Wersja tekstowa (kampanie — część filtrów antyspamowych jej oczekuje). */
  text?:   string
  /** Dodatkowe nagłówki, np. List-Unsubscribe przy kampaniach. */
  headers?: Record<string, string>
}

/** Czy SMTP jest skonfigurowany (bez niego żaden mail nie wyjdzie). */
export const isMailConfigured = () => Boolean(smtpTransporter)

/** Zwraca `false`, gdy SMTP nie jest skonfigurowany (mail nie wyszedł). Błąd wysyłki rzuca. */
export async function sendMail({ to, subject, html, text, headers }: SendMailOptions): Promise<boolean> {
  if (!smtpTransporter) {
    console.warn('⚠️ Mail — brak konfiguracji SMTP (SMTP_HOST/SMTP_PORT), mail nie został wysłany.')
    return false
  }

  try {
    await smtpTransporter.sendMail({
      from:    MAIL_FROM,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
      ...(headers ? { headers } : {}),
    })
    return true
  } catch (err) {
    console.error('❌ Mail — błąd wysyłki przez SMTP:', err)
    throw err
  }
}
