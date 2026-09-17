import { NextRequest, NextResponse } from 'next/server'
import { getReviewSummaries } from '@/lib/reviews'
import { REVIEW_SUMMARY_BATCH_MAX, isValidProductId, type ReviewSummary } from '@/lib/reviewsShared'

export const dynamic = 'force-dynamic'

/**
 * GET /api/reviews/summary?ids=a,b,c
 * Średnia i liczba opinii dla wielu produktów naraz — kafelki w karuzelach
 * i na wishliście zbierają identyfikatory i pytają jednym żądaniem.
 * Krótki cache współdzielony (CDN); przeglądarka zawsze pyta od nowa, żeby
 * klient widział swoją świeżo dodaną opinię.
 */
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get('ids') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(isValidProductId)
    .slice(0, REVIEW_SUMMARY_BATCH_MAX)

  if (!ids.length) {
    return NextResponse.json({ summaries: {} }, { headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const full = await getReviewSummaries(ids)
    const summaries: Record<string, ReviewSummary> = {}
    for (const id of ids) {
      const s = full[id]
      summaries[id] = { average: s?.average ?? 0, count: s?.count ?? 0 }
    }
    return NextResponse.json(
      { summaries },
      { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=120' } },
    )
  } catch (err) {
    console.error('[api/reviews/summary] GET failed', err)
    return NextResponse.json({ error: 'failed' }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}
