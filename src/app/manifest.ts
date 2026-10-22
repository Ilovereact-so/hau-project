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
    theme_color: '#4ECCB5',
    lang: 'pl-PL',
    // Ikony HAU: miętowe tło (kolor logo), białe „HAU”. Wersja „maskable” ma
    // znak w bezpiecznej strefie — Android przycina ikonę do koła/kropli.
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
