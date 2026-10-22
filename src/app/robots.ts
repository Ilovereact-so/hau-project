import type { MetadataRoute } from 'next'
import { NOINDEX_PATHS, SITE_INDEXABLE, SITE_URL, absoluteUrl } from '@/lib/site'

/**
 * robots.txt. Blokujemy wszystko, co jest prywatne albo nie ma wartości
 * w wyszukiwarce (panel, Studio, API, konto, kasa). Wyniki wyszukiwania
 * i listingi z filtrami mają `noindex` w metadanych — tu ich nie blokujemy,
 * żeby robot mógł wejść i zobaczyć ten `noindex` oraz podążyć za linkami.
 */
// Na żądanie: odporne na inną wersję Next.js na serwerze (patrz manifest.ts)
// i czyta `SITE_INDEXABLE` z `.env` serwera, a nie z chwili budowania.
export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  // Staging / podgląd: cała domena poza indeksem, bez mapy strony.
  if (!SITE_INDEXABLE) {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Prefiksowo — `/admin` blokuje też `/admin/produkty`.
        disallow: [...NOINDEX_PATHS],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: SITE_URL,
  }
}
