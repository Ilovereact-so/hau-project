import 'server-only'

/*
 * Kontrola konfiguracji produkcyjnej.
 *
 * Najbardziej kosztowne awarie sklepu to te ciche: brakuje jednej zmiennej
 * w `.env`, aplikacja wstaje normalnie, a problem wychodzi dopiero przy
 * pierwszym zamówieniu albo przy webhooku płatności. Ten moduł sprawdza
 * konfigurację RAZ, przy starcie procesu, i wypisuje czytelny raport w logu.
 *
 * Świadomie NIE rzuca wyjątkiem: build w CI i tak nie ma dostępu do sekretów
 * produkcyjnych, a wywrócenie całego sklepu przez brak np. SMTP-a byłoby
 * gorsze od braku maila. Krytyczne braki widać w logu jako „BŁĄD”, a stan
 * połączeń na żywo pokazuje panel (`/admin/settings`).
 */

type Requirement = {
  /** Nazwy zmiennych — wystarczy, że ustawiona jest którakolwiek z nich. */
  keys: string[]
  label: string
  /** `critical` — bez tego sklep nie sprzeda; `optional` — funkcja po prostu nie działa. */
  level: 'critical' | 'optional'
}

const REQUIREMENTS: Requirement[] = [
  { keys: ['NEXT_PUBLIC_SANITY_PROJECT_ID'], label: 'Sanity — identyfikator projektu', level: 'critical' },
  { keys: ['NEXT_PUBLIC_SANITY_DATASET'], label: 'Sanity — dataset', level: 'critical' },
  { keys: ['SANITY_API_TOKEN'], label: 'Sanity — token zapisu (panel, import, rejestr cen)', level: 'critical' },
  { keys: ['DB_HOST'], label: 'MySQL — host', level: 'critical' },
  { keys: ['DB_USER'], label: 'MySQL — użytkownik', level: 'critical' },
  { keys: ['DB_NAME'], label: 'MySQL — baza', level: 'critical' },
  { keys: ['REDIS_URL'], label: 'Redis', level: 'critical' },
  { keys: ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'], label: 'Clerk — klucz publiczny', level: 'critical' },
  { keys: ['CLERK_SECRET_KEY'], label: 'Clerk — klucz prywatny', level: 'critical' },
  { keys: ['NEXT_PUBLIC_APP_URL'], label: 'Adres sklepu (kanoniczne adresy, powroty z płatności)', level: 'critical' },
  { keys: ['AUTOPAY_SERVICE_ID', 'P24_MERCHANT_ID'], label: 'Bramka płatności (Autopay albo Przelewy24)', level: 'critical' },
  { keys: ['AUTOPAY_HASH_KEY', 'P24_CRC_KEY'], label: 'Klucz podpisu płatności', level: 'critical' },
  { keys: ['CLERK_WEBHOOK_SECRET'], label: 'Webhook Clerka (tworzenie kont w bazie)', level: 'optional' },
  { keys: ['FURGONETKA_CLIENT_ID'], label: 'Furgonetka (przesyłki i paczkomaty)', level: 'optional' },
  { keys: ['SMTP_HOST'], label: 'SMTP (maile i newsletter)', level: 'optional' },
  { keys: ['CRON_SECRET'], label: 'Sekret zadania cyklicznego (rejestr cen)', level: 'optional' },
  { keys: ['SANITY_PRICE_WEBHOOK_SECRET'], label: 'Sekret webhooka cen z Sanity', level: 'optional' },
  { keys: ['NEXT_PUBLIC_GA_MEASUREMENT_ID'], label: 'Google Analytics (ładowane po zgodzie)', level: 'optional' },
]

export type EnvIssue = { label: string; keys: string[]; level: Requirement['level'] }

/** Braki w konfiguracji — używa tego też panel (`/admin/settings`). */
export function findEnvIssues(): EnvIssue[] {
  return REQUIREMENTS.filter((requirement) => !requirement.keys.some((key) => (process.env[key] ?? '').trim()))
    .map(({ label, keys, level }) => ({ label, keys, level }))
}

let reported = false

/**
 * Wypisuje raport konfiguracji raz na proces. Wywoływane z layoutu sklepu,
 * więc leci do logów serwera przy pierwszym żądaniu po starcie.
 */
export function reportEnvOnce(): void {
  if (reported) return
  reported = true
  if (process.env.NODE_ENV !== 'production') return

  const issues = findEnvIssues()
  if (!issues.length) {
    console.info('[env] Konfiguracja produkcyjna kompletna.')
    return
  }
  for (const issue of issues) {
    const where = issue.keys.join(' albo ')
    if (issue.level === 'critical') console.error(`[env] BŁĄD: brak ${where} — ${issue.label}`)
    else console.warn(`[env] Uwaga: brak ${where} — ${issue.label} (funkcja nieaktywna)`)
  }
}
