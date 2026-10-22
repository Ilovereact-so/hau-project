/*
 * Jedno miejsce z danymi sklepu używanymi w SEO, metadanych i strukturze
 * danych. Bez importów serwerowych — korzystają z tego i strony, i komponenty
 * klienckie (np. baner cookies linkujący do polityki).
 */

const FALLBACK_URL = 'https://ehau.pl'

/** Adres sklepu bez ukośnika na końcu. Z `.env` (NEXT_PUBLIC_APP_URL), z fallbackiem na domenę produkcyjną. */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || FALLBACK_URL).replace(/\/+$/, '')

export const SITE_NAME = 'HAU'
export const SITE_TITLE = 'HAU — sklep z akcesoriami dla psa'
/**
 * Ile dni klient ma na odstąpienie od umowy (zwrot bez podania przyczyny).
 * Ustawowe minimum to 14 dni (art. 27 ustawy o prawach konsumenta). Jeśli
 * regulamin daje więcej — zmień TU, a nie w tekstach: liczba trafia do opisu
 * sklepu, kasy i danych strukturalnych produktu (polityka zwrotów w Google).
 * Musi być zgodna z regulaminem — inna obietnica w opisie niż w regulaminie
 * to praktyka wprowadzająca w błąd.
 */
export const RETURN_WINDOW_DAYS = 14

/**
 * Kto płaci za odesłanie produktu przy odstąpieniu od umowy. Sklep: kupujący
 * (decyzja sprzedawcy, 10.2026). Konsument musi to wiedzieć PRZED zakupem
 * (art. 12 ust. 1 pkt 10 u.p.k.) — inaczej koszt zwrotu obciąża sprzedawcę.
 * Tekst trafia do kasy, maila z potwierdzeniem, formularza odstąpienia
 * i danych strukturalnych (returnFees). Musi zgadzać się z regulaminem.
 */
export const RETURN_SHIPPING_PAID_BY_CUSTOMER = true
export const RETURN_COST_NOTE = RETURN_SHIPPING_PAID_BY_CUSTOMER
  ? 'Bezpośredni koszt odesłania produktu ponosi kupujący.'
  : 'Koszt odesłania produktu pokrywa sklep.'

export const SITE_DESCRIPTION =
  `Akcesoria dla psa: zabawki, maty węchowe, przysmaki, smycze, szelki i posłania. Szybka wysyłka, płatności BLIK i kartą, ${RETURN_WINDOW_DAYS} dni na zwrot.`

export const SITE_LOCALE = 'pl_PL'

/**
 * Czy to środowisko ma trafiać do wyszukiwarek.
 *
 * Na staging/podglądzie ustaw `SITE_INDEXABLE=false` — inaczej Google
 * zaindeksuje kopię sklepu pod inną domeną i zacznie ona konkurować
 * z produkcją o te same treści (klasyczna kara za duplikaty).
 *
 * Uwaga: metadane stron prerenderowanych powstają przy BUDOWANIU, więc flagę
 * trzeba ustawić i w środowisku builda (GitHub Actions), i w `.env` serwera.
 */
export const SITE_INDEXABLE = process.env.SITE_INDEXABLE !== 'false'

/** Bezwzględny adres dla ścieżki (`/product/x` → `https://…/product/x`). */
export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/** Ścieżki, których nie indeksujemy i których nie ma w mapie strony. */
export const NOINDEX_PATHS = [
  '/admin',
  '/studio',
  '/api',
  '/profile',
  '/checkout',
  '/cart',
  '/orders',
  '/zamowienie',
  '/newsletter',
  '/success',
  '/upload',
  '/sign-in',
  '/sign-up',
  '/verify-email',
  '/reset-password',
  '/sso-callback',
  '/403',
  '/404',
] as const

/**
 * Dane sprzedawcy — obowiązkowe w sklepie internetowym (art. 5 ustawy
 * o świadczeniu usług drogą elektroniczną, art. 12 ustawy o prawach
 * konsumenta): pełna nazwa firmy, adres, NIP, rejestr (KRS/CEIDG), e-mail
 * i telefon. Pokazywane w stopce, w mailu z potwierdzeniem zamówienia
 * (wzór formularza odstąpienia) i w danych strukturalnych Organization.
 *
 * Zmienne `NEXT_PUBLIC_SELLER_*` są wkompilowywane przy BUDOWANIU (stopka to
 * komponent kliencki) — w GitHub Actions ustawia się je jako zmienne
 * środowiska (`vars.SELLER_*`), nie tylko w `.env` na serwerze.
 * Brak danych = blok się nie wyświetla, a `/admin/settings` i log startowy
 * zgłaszają brak.
 */
const sellerEnv = (value: string | undefined) => (value ?? '').trim()

export const SELLER = {
  /** Pełna nazwa firmy, np. „HAU sp. z o.o.” albo „Jan Kowalski HAU”. */
  name: sellerEnv(process.env.NEXT_PUBLIC_SELLER_NAME),
  /** Adres w jednej linii: „ul. Przykładowa 1, 30-001 Kraków”. */
  address: sellerEnv(process.env.NEXT_PUBLIC_SELLER_ADDRESS),
  nip: sellerEnv(process.env.NEXT_PUBLIC_SELLER_NIP),
  /** Np. „KRS 0000123456, Sąd Rejonowy dla Krakowa-Śródmieścia…” albo „CEIDG”. */
  registry: sellerEnv(process.env.NEXT_PUBLIC_SELLER_REGISTRY),
  email: sellerEnv(process.env.NEXT_PUBLIC_SELLER_EMAIL),
  phone: sellerEnv(process.env.NEXT_PUBLIC_SELLER_PHONE),
} as const

/** Czy podano minimum wymagane prawem (nazwa, adres, NIP, e-mail). */
export const SELLER_CONFIGURED = Boolean(SELLER.name && SELLER.address && SELLER.nip && SELLER.email)
