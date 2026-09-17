// Odświeża dane produktów trzymane w koszyku (localStorage może mieć stare
// ceny/dostępność, jeśli produkt zmienił się w Sanity od czasu dodania do
// koszyka). Zwraca świeże dane z Sanity dla podanych ID — store patchuje nimi
// istniejące pozycje koszyka, bez zmiany ilości/wariantów.
import { getProductForWishList } from '@/sanity/helpers/clientRequest'
import { sanitizeWishlistIds } from '@/lib/cartMerge'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  // Ta sama walidacja/limit co dla wishlisty — endpoint jest publiczny.
  const ids = sanitizeWishlistIds(
    (req.nextUrl.searchParams.get('ids') ?? '').split(',').map(id => id.trim())
  )

  if (!ids.length) {
    return NextResponse.json({ products: [] })
  }

  const products = await getProductForWishList(ids)

  return NextResponse.json(
    { products },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}
