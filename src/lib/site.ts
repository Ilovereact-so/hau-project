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
export const SITE_DESCRIPTION =
  'Akcesoria dla psa: zabawki, maty węchowe, przysmaki, smycze, szelki i posłania. Szybka wysyłka, płatności BLIK i kartą, 30 dni na zwrot.'

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
