import 'server-only'
import { and, desc, eq, inArray, like, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { productReviews, REVIEW_STATUSES } from '@/db/schema'
import { sanityClient } from '@/sanity/sanityClient.server'
import { urlFor } from '@/sanity/lib/image'
import { parseRating } from '@/lib/reviewsShared'

export type AdminReviewsFilter = {
  status?: string
  rating?: string
  q?: string
  page?: number
  limit?: number
}

export type AdminReviewRow = {
  id: string
  productId: string
  productTitle: string
  productBrand: string
  productSlug: string | null
  productImage: string | null
  userId: string
  authorName: string
  rating: number
  title: string | null
  body: string
  verifiedPurchase: boolean
  status: 'published' | 'hidden'
  adminReply: string | null
  adminReplyAt: Date | null
  createdAt: Date | null
}

export type AdminReviewStats = {
  total: number
  published: number
  hidden: number
  last7: number
  average: number
  lowRated30: number
}

/** Wzorzec LIKE z ucieczką znaków specjalnych — wpisany `%` nie może dopasować wszystkiego. */
function likePattern(value: string) {
  return `%${value.trim().replace(/[\\%_]/g, (match) => `\\${match}`)}%`
}

type ProductMeta = { _id: string; title?: string; brand?: string; slug?: string; image?: unknown }

async function fetchProductMeta(ids: string[]): Promise<Map<string, ProductMeta>> {
  const map = new Map<string, ProductMeta>()
  if (!ids.length) return map
  try {
    const rows = await sanityClient.fetch<ProductMeta[]>(
      `*[_type == "product" && _id in $ids]{ _id, title, brand, "slug": slug.current, "image": images[0] }`,
      { ids },
    )
    for (const row of rows) map.set(row._id, row)
  } catch (err) {
    // Lista opinii ma działać także przy chwilowej awarii Sanity — bez nazw produktów.
    console.error('[admin reviews] sanity lookup failed', err)
  }
  return map
}

/** Identyfikatory produktów, których tytuł/marka pasuje do frazy (wyszukiwarka panelu). */
async function productIdsMatching(q: string): Promise<string[]> {
  const term = q.replace(/[*"\\]/g, ' ').trim()
  if (!term) return []
  try {
    return await sanityClient.fetch<string[]>(
      `*[_type == "product" && (title match $q || brand match $q)][0...100]._id`,
      { q: `*${term}*` },
    )
  } catch {
    return []
  }
}

export async function getAdminReviews(filter: AdminReviewsFilter = {}) {
  const limit = Math.min(Math.max(filter.limit ?? 20, 5), 100)
  const page = Math.max(filter.page ?? 1, 1)

  const conds: SQL[] = []
  if (filter.status && (REVIEW_STATUSES as readonly string[]).includes(filter.status)) {
    conds.push(eq(productReviews.status, filter.status as (typeof REVIEW_STATUSES)[number]))
  }
  const rating = filter.rating ? parseRating(filter.rating) : null
  if (rating) conds.push(eq(productReviews.rating, rating))

  const q = filter.q?.trim()
  if (q) {
    const pattern = likePattern(q)
    const productIds = await productIdsMatching(q)
    const textConds: SQL[] = [
      like(productReviews.body, pattern),
      like(productReviews.title, pattern),
      like(productReviews.authorName, pattern),
      eq(productReviews.userId, q),
      eq(productReviews.productId, q),
    ]
    if (productIds.length) {
      textConds.push(inArray(productReviews.productId, productIds))
    }
    conds.push(or(...textConds) as SQL)
  }

  const where = conds.length ? and(...conds) : undefined

  const [rows, [countRow]] = await Promise.all([
    db
      .select()
      .from(productReviews)
      .where(where)
      .orderBy(desc(productReviews.createdAt), desc(productReviews.id))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ count: sql<number>`COUNT(*)` }).from(productReviews).where(where),
  ])

  const meta = await fetchProductMeta([...new Set(rows.map((row) => row.productId))])

  const result: AdminReviewRow[] = rows.map((row) => {
    const product = meta.get(row.productId)
    let image: string | null = null
    try {
      image = product?.image ? urlFor(product.image as Parameters<typeof urlFor>[0]).width(96).height(96).url() : null
    } catch {
      image = null
    }
    return {
      id: row.id,
      productId: row.productId,
      productTitle: product?.title ?? 'Produkt usunięty z katalogu',
      productBrand: product?.brand ?? '',
      productSlug: product?.slug ?? null,
      productImage: image,
      userId: row.userId,
      authorName: row.authorName,
      rating: row.rating,
      title: row.title,
      body: row.body,
      verifiedPurchase: row.verifiedPurchase,
      status: row.status,
      adminReply: row.adminReply,
      adminReplyAt: row.adminReplyAt,
      createdAt: row.createdAt,
    }
  })

  return { rows: result, total: Number(countRow?.count ?? 0), page, limit }
}

export async function getAdminReviewStats(): Promise<AdminReviewStats> {
  const [row] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      published: sql<number>`SUM(CASE WHEN ${productReviews.status} = 'published' THEN 1 ELSE 0 END)`,
      hidden: sql<number>`SUM(CASE WHEN ${productReviews.status} = 'hidden' THEN 1 ELSE 0 END)`,
      last7: sql<number>`SUM(CASE WHEN ${productReviews.createdAt} >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END)`,
      average: sql<number>`AVG(CASE WHEN ${productReviews.status} = 'published' THEN ${productReviews.rating} END)`,
      lowRated30: sql<number>`SUM(CASE WHEN ${productReviews.rating} <= 2 AND ${productReviews.createdAt} >= NOW() - INTERVAL 30 DAY THEN 1 ELSE 0 END)`,
    })
    .from(productReviews)

  const num = (v: unknown) => Number(v ?? 0) || 0
  return {
    total: num(row?.total),
    published: num(row?.published),
    hidden: num(row?.hidden),
    last7: num(row?.last7),
    average: Math.round(num(row?.average) * 10) / 10,
    lowRated30: num(row?.lowRated30),
  }
}
