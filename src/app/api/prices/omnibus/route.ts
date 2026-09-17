import { NextRequest, NextResponse } from 'next/server'
import { getOmnibusForProducts } from '@/lib/priceHistory'
import { OMNIBUS_BATCH_MAX, isValidProductId } from '@/lib/omnibus'

export const dynamic = 'force-dynamic'

/**
 * GET /api/prices/omnibus?ids=a,b,c
 * Najniższa cena z 30 dni (i ewentualna obniżka) dla kafelków produktów —
 * per klucz ceny (`''` = cena bazowa, pozostałe = `variants[]._key`).
 * Przy okazji uzgadnia rejestr cen z Sanity (najwyżej raz na 2 min na produkt),
 * więc zmiana zrobiona w Studio bez webhooka zostanie zarejestrowana przy
 * pierwszym wyświetleniu.
 */
export async function GET(req: NextRequest) {
  const ids = [
    ...new Set(
      (req.nextUrl.searchParams.get('ids') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(isValidProductId),
    ),
  ].slice(0, OMNIBUS_BATCH_MAX)

  if (!ids.length) {
    return NextResponse.json({ prices: {} }, { headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const prices = await getOmnibusForProducts(ids, { reconcile: true })
    return NextResponse.json(
      { prices },
      { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' } },
    )
  } catch (err) {
    console.error('[api/prices/omnibus] GET failed', err)
    return NextResponse.json({ error: 'failed' }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}
