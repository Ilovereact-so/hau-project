/*
 * Nagłówki bezpieczeństwa wysyłane przy każdej odpowiedzi (patrz next.config.ts).
 *
 * Lista źródeł w CSP odpowiada temu, co sklep faktycznie ładuje:
 *  - Clerk (logowanie)            — skrypty i API kont,
 *  - Sanity (katalog + Studio)    — obrazy, API, dane na żywo,
 *  - Google Analytics            — tylko po zgodzie, ale host musi być dozwolony,
 *  - Autopay / Przelewy24        — ramka płatności i formularz karty,
 *  - Furgonetka                  — widżet mapy paczkomatów,
 *  - YouTube / Vimeo             — odtwarzacz w poradnikach.
 *
 * TRYB: domyślnie CSP idzie jako `Content-Security-Policy-Report-Only`, czyli
 * przeglądarka tylko zgłasza naruszenia w konsoli i NIC nie blokuje. Gdy
 * sprawdzisz, że konsola jest czysta (przeklikaj kasę, mapę paczkomatów,
 * logowanie i Studio), ustaw w `.env`:
 *
 *     CSP_MODE=enforce
 *
 * i polityka zacznie realnie blokować. `CSP_MODE=off` wyłącza sam nagłówek CSP
 * (pozostałe nagłówki zostają).
 */

const SELF = "'self'"

const CLERK = ['https://*.clerk.com', 'https://*.clerk.accounts.dev', 'https://*.clerk.services']
const SANITY = ['https://cdn.sanity.io', 'https://*.api.sanity.io', 'https://*.apicdn.sanity.io', 'https://*.sanity.io']
const GOOGLE = ['https://www.googletagmanager.com', 'https://www.google-analytics.com', 'https://*.google-analytics.com', 'https://*.analytics.google.com']
const PAYMENTS = ['https://*.autopay.eu', 'https://*.blue-media.pl', 'https://*.przelewy24.pl', 'https://*.przelewy24.com']
const SHIPPING = ['https://furgonetka.pl', 'https://*.furgonetka.pl']
const VIDEO = ['https://www.youtube-nocookie.com', 'https://www.youtube.com', 'https://player.vimeo.com', 'https://i.ytimg.com']
const FONTS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com']

/** Buduje wartość nagłówka CSP. W dev dokładamy to, czego wymaga HMR i Studio. */
export function buildContentSecurityPolicy(isDev: boolean): string {
  const directives: Record<string, string[]> = {
    'default-src': [SELF],
    // `unsafe-inline` jest potrzebne dla skryptów startowych Next.js i danych
    // strukturalnych JSON-LD; `unsafe-eval` tylko w dev (HMR i Sanity Studio).
    'script-src': [SELF, "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : []), ...CLERK, ...GOOGLE, ...SANITY, ...SHIPPING, ...VIDEO],
    'style-src': [SELF, "'unsafe-inline'", ...FONTS],
    'img-src': [SELF, 'data:', 'blob:', ...SANITY, ...CLERK, ...GOOGLE, ...VIDEO, ...SHIPPING],
    'font-src': [SELF, 'data:', ...FONTS],
    'connect-src': [SELF, ...CLERK, ...SANITY, ...GOOGLE, ...PAYMENTS, ...SHIPPING, ...(isDev ? ['ws:', 'wss:'] : [])],
    // Ramki: płatność kartą (Autopay), mapa paczkomatów, odtwarzacze wideo, Clerk.
    'frame-src': [SELF, ...PAYMENTS, ...SHIPPING, ...VIDEO, ...CLERK],
    'media-src': [SELF, 'blob:', ...SANITY],
    'worker-src': [SELF, 'blob:'],
    'form-action': [SELF, ...PAYMENTS],
    // Nikt nie osadza sklepu w swojej ramce (ochrona przed clickjackingiem).
    'frame-ancestors': ["'none'"],
    'base-uri': [SELF],
    'object-src': ["'none'"],
  }

  const policy = Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(' ')}`)
    .join('; ')

  // Na produkcji wymuszamy HTTPS dla wszystkich podzasobów.
  return isDev ? policy : `${policy}; upgrade-insecure-requests`
}

export type HeaderEntry = { key: string; value: string }

/** Nagłówki wspólne dla całego sklepu. */
export function securityHeaders(isDev: boolean): HeaderEntry[] {
  const mode = (process.env.CSP_MODE || 'report-only').toLowerCase()
  const headers: HeaderEntry[] = [
    // Przeglądarka nie zgaduje typu pliku (ochrona przed „MIME sniffing”).
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // Starszy odpowiednik frame-ancestors — dla przeglądarek bez pełnego CSP.
    { key: 'X-Frame-Options', value: 'DENY' },
    // Do innych domen wysyłamy samą domenę, nie pełny adres z parametrami.
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Wyłączamy nieużywane API przeglądarki.
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
    { key: 'X-DNS-Prefetch-Control', value: 'on' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  ]

  if (!isDev) {
    // HSTS: po pierwszej wizycie przeglądarka wchodzi już tylko po HTTPS.
    headers.push({ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' })
  }

  if (mode !== 'off') {
    headers.push({
      key: mode === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
      value: buildContentSecurityPolicy(isDev),
    })
  }

  return headers
}
