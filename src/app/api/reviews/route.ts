import { NextRequest, NextResponse } from 'next/server'
import { listProductReviews } from '@/lib/reviews'
import { isReviewSort, isValidProductId, parseRating } from '@/lib/reviewsShared'

// Lista opinii zmienia się po każdym zapisie — bez cache po stronie Next.
export const dynamic = 'force-dynamic'

const HEADERS = { 'Cache-Control': 'no-store' }

/**
 * GET /api/reviews?productId=…&sort=newest|highest|lowest&rating=1-5&offset=0
 * Publiczna lista opublikowanych opinii produktu (porcje po REVIEWS_PAGE_SIZE).
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const productId = params.get('productId')
  if (!isValidProductId(productId)) {
    return NextResponse.json({ error: 'invalid productId' }, { status: 400, headers: HEADERS })
  }

  const sortParam = params.get('sort')
  const ratingParam = params.get('rating')
  const rating = ratingParam ? parseRating(ratingParam) : null
  if (ratingParam && rating === null) {
    return NextResponse.json({ error: 'invalid rating' }, { status: 400, headers: HEADERS })
  }
  const offset = Number.parseInt(params.get('offset') ?? '0', 10)

  try {
    const page = await listProductReviews(productId, {
      sort: isReviewSort(sortParam) ? sortParam : 'newest',
      rating,
      offset: Number.isFinite(offset) ? offset : 0,
    })
    return NextResponse.json(page, { headers: HEADERS })
  } catch (err) {
    console.error('[api/reviews] GET failed', err)
    return NextResponse.json({ error: 'failed' }, { status: 502, headers: HEADERS })
  }
}
