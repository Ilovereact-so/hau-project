import { NextRequest, NextResponse } from 'next/server'
import { sanityClient } from '@/sanity/sanityClient.server'
import { searchProductIds } from '@/lib/searchIndex.server'
import { SEARCH_MIN_QUERY } from '@/lib/search'

export const dynamic = 'force-dynamic'

/**
 * Podpowiedzi wyszukiwarki (panel w nagłówku). Dopasowanie po nazwie,
 * marce, kategoriach, tagach, SKU i opisach — lib/search.ts; tu tylko
 * dociągamy dane kafelka podpowiedzi dla najlepszych trafień.
 */
const LIMIT = 8

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 100)
  if (query.trim().length < SEARCH_MIN_QUERY) return NextResponse.json({ results: [], total: 0 })

  const ids = await searchProductIds(query, 200)
  if (!ids.length) return NextResponse.json({ results: [], total: 0 })

  const top = ids.slice(0, LIMIT)
  const rows = await sanityClient.fetch<Array<{ _id: string }>>(
    `*[_type == "product" && _id in $ids]{
      _id, title, subtitle, brand, price, promotion, images[0...1],
      "variants": variants[]{ _key, price, stock },
      stock,
      "category": category->{ "slug": slug.current, title },
      "type": type->{ "slug": slug.current, title },
      "slug": slug.current
    }`,
    { ids: top },
    { next: { revalidate: 60, tags: ['sanity'] } },
  )
  const order = new Map(top.map((id, index) => [id, index]))
  const results = rows.sort((a, b) => (order.get(a._id) ?? 0) - (order.get(b._id) ?? 0))
  return NextResponse.json(
    { results, total: ids.length },
    { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' } },
  )
}
