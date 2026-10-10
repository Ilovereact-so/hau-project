import 'server-only'
import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orders, paymentTransactions, shipments } from '@/db/schema'
import { redis } from '@/lib/redis'
import { sanityClient } from '@/sanity/sanityClient.server'
import type { AdminCounters } from '@/components/admin/layout/navigation'

// Próg „niskiego stanu” (stan < 2 → 1 sztuka albo brak) — jedno źródło w lib/stock.ts.
import { LOW_STOCK_THRESHOLD } from '@/lib/stock'
export { LOW_STOCK_THRESHOLD }
const LOW_STOCK_CACHE = 'admin:counters:lowStock'

/**
 * Zamówienia czekające na nadanie paczki: opłacone albo przyjęte do
 * realizacji (za pobraniem trafiają od razu do `processing`), bez przesyłki.
 */
export const toShipCondition = () =>
  and(inArray(orders.status, ['paid', 'processing']), isNull(shipments.id))

async function countToShip() {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(orders)
    .leftJoin(shipments, eq(shipments.orderId, orders.id))
    .where(toShipCondition())
  return Number(row?.count ?? 0)
}

async function countFailedPayments() {
  const since = new Date(Date.now() - 7 * 86400_000)
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(paymentTransactions)
    .where(and(eq(paymentTransactions.status, 'failed'), gte(paymentTransactions.createdAt, since)))
  return Number(row?.count ?? 0)
}

export async function countLowStockProducts(): Promise<number> {
  try {
    const cached = await redis.get(LOW_STOCK_CACHE)
    if (cached !== null) return Number(cached)
  } catch {
    /* Redis niedostępny — liczymy bez cache */
  }
  const count = await sanityClient.fetch<number>(
    `count(*[_type == "product" && !(_id in path("drafts.**")) && (
      count(variants[defined(stock) && stock < $t]) > 0 ||
      (count(variants) == 0 && defined(stock) && stock < $t)
    )])`,
    { t: LOW_STOCK_THRESHOLD }
  )
  try {
    await redis.setEx(LOW_STOCK_CACHE, 60, String(count))
  } catch {
    /* jw. */
  }
  return count
}

export async function invalidateLowStockCounter() {
  try {
    await redis.del(LOW_STOCK_CACHE)
  } catch {
    /* jw. */
  }
}

/**
 * Liczniki do sidebaru i topbaru. Layout panelu nie może się wywrócić
 * przez chwilową niedostępność bazy albo Sanity — każde źródło osobno,
 * z zerem jako wartością awaryjną.
 */
export async function getAdminCounters(): Promise<AdminCounters> {
  const [toShip, failedPayments, lowStock] = await Promise.all([
    countToShip().catch(() => 0),
    countFailedPayments().catch(() => 0),
    countLowStockProducts().catch(() => 0),
  ])
  return { toShip, failedPayments, lowStock }
}
