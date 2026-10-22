import { NextResponse } from 'next/server'
import { getShopSettings } from '@/lib/shopSettings.server'
import { memoize } from '@/lib/memo'

/**
 * Publiczne ustawienia koszyka (próg darmowej dostawy, najtańsza dostawa, linki social).
 *
 * Celowo DYNAMICZNA, a nie `revalidate`: trasa prerenderowana przy budowaniu
 * czyta wpis cache w formacie wersji Next.js z builda — przy innej wersji
 * w `node_modules` serwera dawała 500 („reading 'kind'”, awaria 22.10.2026).
 * Obciążenie Sanity trzyma bufor procesu (60 s) i `Cache-Control` w przeglądarce.
 */
export const dynamic = 'force-dynamic'

const cachedSettings = memoize(() => getShopSettings(), 60_000)

export async function GET() {
  const settings = await cachedSettings()
  return NextResponse.json(settings, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
  })
}
