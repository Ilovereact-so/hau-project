import type { MetadataRoute } from 'next'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from '@/lib/site'

/*
 * Dynamiczny, nie prerenderowany przy budowaniu: wpis cache z builda jest
 * w formacie wersji Next.js z CI i przy innej wersji na serwerze dawał 500
 * (awaria 22.10.2026). Plik jest maleńki, więc renderowanie na żądanie nic nie kosztuje.
 */
export const dynamic = 'force-dynamic'

/** Manifest PWA — nazwa i kolory przy „dodaj do ekranu głównego” na telefonie. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_TITLE,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1a1a1a',
    lang: 'pl-PL',
    icons: [
      { src: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
      { src: '/logo_hau.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }
}
