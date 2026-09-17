import 'server-only'
import { and, gte, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { orderItems, orders } from '@/db/schema'
import { getReviewSummaries } from '@/lib/reviews'
import { getOmnibusForProducts } from '@/lib/priceHistory'
import { REVIEW_SUMMARY_BATCH_MAX } from '@/lib/reviewsShared'
import { isValidProductId, tilePriceKey } from '@/lib/omnibus'
import {
  signalsNeeded,
  sortProducts,
  type ProductSort,
  type SortSignals,
  type SortableProduct,
} from '@/lib/productSort'

/*
 * Dane potrzebne do sortowania listingów (server-only).
 *
 * Każdy sygnał ma własne źródło i własny cache, a strona pobiera TYLKO ten,
 * którego wymaga wybrane sortowanie (`signalsNeeded`). Awaria dowolnego
 * źródła nie może wywrócić listingu — wtedy sortujemy tym, co mamy.
 */

const POPULARITY_KEY = 'products:popularity:v1'
const POPULARITY_TTL_SECONDS = 1800
/** Okno liczenia sprzedaży — „popularne teraz”, nie „popularne kiedykolwiek”. */
const POPULARITY_WINDOW_DAYS = 90
/** Zamówienia, które realnie doszły do skutku (jak przychód w panelu). */
const SOLD_STATUSES = ['paid', 'processing', 'shipped', 'delivered'] as const

/**
 * Sprzedane sztuki na produkt z ostatnich 90 dni. Jedno zapytanie dla całego
 * sklepu (wynik i tak jest mały) + cache w Redisie, więc listing z sortowaniem
 * „Popularne” nie dokłada zapytania na każde wejście.
 */
export async function getPopularityScores(): Promise<Map<string, number>> {
  try {
    const cached = await redis.get(POPULARITY_KEY)
    if (cached) {
      const parsed = JSON.parse(cached) as Array<[string, number]>
      if (Array.isArray(parsed)) return new Map(parsed)
    }
  } catch {
    /* cache jest opcjonalny */
  }

  const since = new Date(Date.now() - POPULARITY_WINDOW_DAYS * 86_400_000)
  const rows = await db
    .select({
      productId: orderItems.productId,
      units: sql<string>`COALESCE(SUM(${orderItems.qty}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, sql`${orders.id} = ${orderItems.orderId}`)
    .where(and(gte(orders.createdAt, since), inArray(orders.status, [...SOLD_STATUSES])))
    .groupBy(orderItems.productId)

  const scores = new Map<string, number>()
  for (const row of rows) {
    const units = Number(row.units)
    if (row.productId && Number.isFinite(units) && units > 0) scores.set(row.productId, units)
  }

  try {
    await redis.set(POPULARITY_KEY, JSON.stringify([...scores]), { EX: POPULARITY_TTL_SECONDS })
  } catch {
    /* cache jest opcjonalny */
  }
  return scores
}

/** Średnie ocen dla dowolnie długiej listy (API opinii liczy porcjami po 60). */
async function getRatings(productIds: string[]): Promise<Map<string, { average: number; count: number }>> {
  const result = new Map<string, { average: number; count: number }>()
  const ids = productIds.filter(isValidProductId)
  for (let i = 0; i < ids.length; i += REVIEW_SUMMARY_BATCH_MAX) {
    const chunk = ids.slice(i, i + REVIEW_SUMMARY_BATCH_MAX)
    const summaries = await getReviewSummaries(chunk)
    for (const [id, summary] of Object.entries(summaries)) {
      result.set(id, { average: summary.average, count: summary.count })
    }
  }
  return result
}

/** Procent obniżki (z rejestru cen) dla ceny widocznej na kafelku. */
async function getDiscounts(products: SortableProduct[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  const ids = products.map((product) => product._id).filter(isValidProductId)
  if (!ids.length) return result
  const omnibus = await getOmnibusForProducts(ids)
  for (const product of products) {
    const key = product.defaultVariant || tilePriceKey(product)
    const info = omnibus[product._id]?.[key] ?? omnibus[product._id]?.['']
    if (info?.promo) result.set(product._id, info.promo.percent)
  }
  return result
}

/**
 * Sortuje listę produktów wg wyboru z adresu. Pobiera tylko te dane, których
 * wymaga wybrane sortowanie; błąd źródła jest logowany i pomijany (lista
 * zostaje posortowana dostępnymi sygnałami, nigdy nie znika).
 */
export async function sortProductsForListing<T extends SortableProduct>(
  products: T[],
  sort: ProductSort,
): Promise<T[]> {
  if (products.length < 2) return products

  const needed = new Set(signalsNeeded(sort))
  const signals: SortSignals = {}

  await Promise.all([
    needed.has('popularity')
      ? getPopularityScores()
          .then((scores) => {
            signals.popularity = scores
          })
          .catch((err) => console.error('[listing] popularity failed', err))
      : null,
    needed.has('rating')
      ? getRatings(products.map((product) => product._id))
          .then((ratings) => {
            signals.rating = ratings
          })
          .catch((err) => console.error('[listing] ratings failed', err))
      : null,
    needed.has('discount')
      ? getDiscounts(products)
          .then((discounts) => {
            signals.discount = discounts
          })
          .catch((err) => console.error('[listing] discounts failed', err))
      : null,
  ])

  return sortProducts(products, sort, signals)
}
