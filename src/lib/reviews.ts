import 'server-only'
import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { orderItems, orders, productReviews } from '@/db/schema'
import { sanityClient } from '@/sanity/sanityClient.server'
import {
  EMPTY_SUMMARY,
  REVIEW_SUMMARY_BATCH_MAX,
  REVIEWS_PAGE_SIZE,
  isValidProductId,
  summaryFromDistribution,
  type MyReview,
  type PublicReview,
  type ReviewPage,
  type ReviewSort,
  type ReviewSummaryFull,
} from '@/lib/reviewsShared'

/*
 * Warstwa danych opinii (MySQL = źródło prawdy, Redis = cache podsumowań).
 *
 * Podsumowanie (średnia + rozkład) liczymy z opinii o statusie `published`
 * i trzymamy w Redisie per produkt. Każdy zapis (dodanie, edycja, usunięcie,
 * moderacja) woła `invalidateReviewSummary`, więc TTL jest tylko siatką
 * bezpieczeństwa na wypadek zmian robionych ręcznie w bazie.
 */

const SUMMARY_TTL_SECONDS = 60 * 10
const summaryKey = (productId: string) => `reviews:summary:${productId}`

/** Statusy zamówień, które uznajemy za faktyczny zakup (jak przychód w panelu). */
const PURCHASED_STATUSES = ['paid', 'processing', 'shipped', 'delivered'] as const

type ReviewRow = typeof productReviews.$inferSelect

const iso = (value: Date | null | undefined) => (value ? value.toISOString() : null)

export function toPublicReview(row: ReviewRow): PublicReview {
  return {
    id: row.id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    authorName: row.authorName,
    verifiedPurchase: row.verifiedPurchase,
    adminReply: row.adminReply,
    adminReplyAt: iso(row.adminReplyAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}

function isDistribution(value: unknown): value is ReviewSummaryFull['distribution'] {
  return Array.isArray(value) && value.length === 5 && value.every((n) => Number.isInteger(n) && n >= 0)
}

// ─── podsumowania ─────────────────────────────────────────────────────────────

async function computeSummaries(productIds: string[]): Promise<Map<string, ReviewSummaryFull>> {
  const result = new Map<string, ReviewSummaryFull>()
  if (!productIds.length) return result

  const rows = await db
    .select({
      productId: productReviews.productId,
      rating: productReviews.rating,
      count: sql<number>`COUNT(*)`,
    })
    .from(productReviews)
    .where(and(inArray(productReviews.productId, productIds), eq(productReviews.status, 'published')))
    .groupBy(productReviews.productId, productReviews.rating)

  const distributions = new Map<string, ReviewSummaryFull['distribution']>()
  for (const id of productIds) distributions.set(id, [0, 0, 0, 0, 0])
  for (const row of rows) {
    const dist = distributions.get(row.productId)
    const index = Number(row.rating) - 1
    if (dist && index >= 0 && index < 5) dist[index] += Number(row.count)
  }
  for (const [id, dist] of distributions) result.set(id, summaryFromDistribution(dist))
  return result
}

/**
 * Podsumowania wielu produktów naraz (kafelki list, karuzele).
 * Redis → brakujące liczymy jednym zapytaniem SQL i odkładamy do cache.
 * Awaria Redisa nie blokuje odpowiedzi — liczymy wtedy wszystko z bazy.
 */
export async function getReviewSummaries(productIds: string[]): Promise<Record<string, ReviewSummaryFull>> {
  const ids = [...new Set(productIds.filter(isValidProductId))].slice(0, REVIEW_SUMMARY_BATCH_MAX)
  const out: Record<string, ReviewSummaryFull> = {}
  if (!ids.length) return out

  let missing = ids
  try {
    const cached = await redis.mGet(ids.map(summaryKey))
    missing = []
    ids.forEach((id, i) => {
      const raw = cached[i]
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw) as { distribution?: unknown }
          if (isDistribution(parsed.distribution)) {
            out[id] = summaryFromDistribution(parsed.distribution)
            return
          }
        } catch {
          /* uszkodzony wpis — policzymy od nowa */
        }
      }
      missing.push(id)
    })
  } catch (err) {
    console.error('[reviews] redis read failed, computing from MySQL', err)
  }

  if (missing.length) {
    const computed = await computeSummaries(missing)
    for (const [id, summary] of computed) out[id] = summary
    try {
      const multi = redis.multi()
      for (const [id, summary] of computed) {
        multi.setEx(summaryKey(id), SUMMARY_TTL_SECONDS, JSON.stringify({ distribution: summary.distribution }))
      }
      await multi.exec()
    } catch (err) {
      console.error('[reviews] redis write failed', err)
    }
  }
  return out
}

export async function getReviewSummary(productId: string): Promise<ReviewSummaryFull> {
  if (!isValidProductId(productId)) return EMPTY_SUMMARY
  const all = await getReviewSummaries([productId])
  return all[productId] ?? EMPTY_SUMMARY
}

export async function invalidateReviewSummary(productId: string) {
  try {
    await redis.del(summaryKey(productId))
  } catch (err) {
    console.error('[reviews] redis invalidate failed', err)
  }
}

// ─── lista opinii ─────────────────────────────────────────────────────────────

export async function listProductReviews(
  productId: string,
  {
    sort = 'newest',
    rating = null,
    offset = 0,
    limit = REVIEWS_PAGE_SIZE,
  }: { sort?: ReviewSort; rating?: number | null; offset?: number; limit?: number } = {},
): Promise<ReviewPage> {
  if (!isValidProductId(productId)) return { reviews: [], total: 0, hasMore: false }

  const safeLimit = Math.min(Math.max(Math.trunc(limit) || REVIEWS_PAGE_SIZE, 1), 20)
  const safeOffset = Math.min(Math.max(Math.trunc(offset) || 0, 0), 10_000)

  const conds: SQL[] = [eq(productReviews.productId, productId), eq(productReviews.status, 'published')]
  if (rating) conds.push(eq(productReviews.rating, rating))
  const where = and(...conds)

  const order =
    sort === 'highest'
      ? [desc(productReviews.rating), desc(productReviews.createdAt), asc(productReviews.id)]
      : sort === 'lowest'
        ? [asc(productReviews.rating), desc(productReviews.createdAt), asc(productReviews.id)]
        : [desc(productReviews.createdAt), asc(productReviews.id)]

  const [rows, [countRow]] = await Promise.all([
    db.select().from(productReviews).where(where).orderBy(...order).limit(safeLimit).offset(safeOffset),
    db.select({ count: sql<number>`COUNT(*)` }).from(productReviews).where(where),
  ])

  const total = Number(countRow?.count ?? 0)
  return {
    reviews: rows.map(toPublicReview),
    total,
    hasMore: safeOffset + rows.length < total,
  }
}

// ─── opinia zalogowanego klienta ──────────────────────────────────────────────

export async function getUserReview(userId: string, productId: string): Promise<MyReview | null> {
  if (!isValidProductId(productId)) return null
  const [row] = await db
    .select()
    .from(productReviews)
    .where(and(eq(productReviews.userId, userId), eq(productReviews.productId, productId)))
    .limit(1)
  return row ? { ...toPublicReview(row), status: row.status } : null
}

/** Czy konto ma opłacone (lub dalej realizowane) zamówienie z tym produktem. */
export async function hasPurchasedProduct(userId: string, productId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.userId, userId),
        eq(orderItems.productId, productId),
        inArray(orders.status, [...PURCHASED_STATUSES]),
      ),
    )
    .limit(1)
  return Boolean(row)
}

/** Produkt musi istnieć w opublikowanym katalogu — nie przyjmujemy opinii o dowolnym ID. */
export async function productExists(productId: string): Promise<boolean> {
  if (!isValidProductId(productId)) return false
  const count = await sanityClient.fetch<number>(
    'count(*[_type == "product" && _id == $id])',
    { id: productId },
  )
  return count > 0
}

// ─── ochrona przed zalewaniem ─────────────────────────────────────────────────

const RATE_WINDOW_SECONDS = 10 * 60
const RATE_MAX_WRITES = 6

/**
 * Prosty limit zapisów na konto (okno 10 min). Przy niedostępnym Redisie
 * przepuszczamy — opinia i tak wymaga zalogowania, a jedna na produkt.
 */
export async function consumeReviewWriteQuota(userId: string): Promise<boolean> {
  const key = `reviews:rate:${userId}`
  try {
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, RATE_WINDOW_SECONDS)
    return count <= RATE_MAX_WRITES
  } catch (err) {
    console.error('[reviews] rate limit unavailable', err)
    return true
  }
}
