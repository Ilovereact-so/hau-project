import 'server-only'
import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  cartItems, orderItems, orders, paymentTransactions, shipments, shippingAddresses,
} from '@/db/schema'
import { listAdminProducts } from '@/lib/admin/catalog'
import { toShipCondition } from '@/lib/admin/counters'

// ─── definicje biznesowe ──────────────────────────────────────────────────────

// Przychód liczymy z zamówień, które realnie doszły do skutku — pomijamy
// pending/awaiting_payment/cancelled/refunded (snapshot cen w totalCents).
export const REVENUE_STATUSES = ['paid', 'processing', 'shipped', 'delivered'] as const

export { LOW_STOCK_THRESHOLD } from '@/lib/admin/counters'

const DAY = 86400_000
const num = (v: unknown) => Number(v ?? 0)

export async function getRevenueBetween(from: Date, to?: Date) {
  const conds = [gte(orders.createdAt, from), inArray(orders.status, [...REVENUE_STATUSES])]
  if (to) conds.push(lt(orders.createdAt, to))
  const [row] = await db
    .select({
      revenue: sql<string>`COALESCE(SUM(${orders.totalCents}), 0)`,
      shipping: sql<string>`COALESCE(SUM(${orders.shippingCents}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .where(and(...conds))
  return { revenueCents: num(row?.revenue), shippingCents: num(row?.shipping), count: num(row?.count) }
}

/** Klucz dnia w strefie serwera — ten sam, którego używa `DATE()` w MySQL. */
function dayKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function normalizeDay(value: unknown): string {
  if (value instanceof Date) return dayKey(value)
  return String(value).slice(0, 10)
}

export type RecentOrder = {
  id: string
  status: string
  paymentMethod: string
  totalCents: number
  createdAt: Date | null
  customer: string
  itemSummary: string
}

/** Pozycje i nazwisko klienta dla listy zamówień (jedno zapytanie na listę, nie na wiersz). */
export async function describeOrders(ids: string[]) {
  if (!ids.length) return { items: new Map<string, string>(), customers: new Map<string, { name: string; email: string }>() }
  const [itemRows, addressRows] = await Promise.all([
    db
      .select({ orderId: orderItems.orderId, name: orderItems.name, qty: orderItems.qty })
      .from(orderItems)
      .where(inArray(orderItems.orderId, ids)),
    db
      .select({
        orderId: shippingAddresses.orderId,
        firstName: shippingAddresses.firstName,
        lastName: shippingAddresses.lastName,
        email: shippingAddresses.email,
      })
      .from(shippingAddresses)
      .where(inArray(shippingAddresses.orderId, ids)),
  ])

  const grouped = new Map<string, Array<{ name: string; qty: number }>>()
  for (const row of itemRows) {
    const list = grouped.get(row.orderId) ?? []
    list.push({ name: row.name, qty: row.qty })
    grouped.set(row.orderId, list)
  }
  const items = new Map<string, string>()
  for (const [orderId, list] of grouped) {
    const first = list[0]
    const units = list.reduce((sum, item) => sum + item.qty, 0)
    items.set(
      orderId,
      list.length > 1 ? `${first.name} + ${list.length - 1} inne (${units} szt.)` : `${first.name}${first.qty > 1 ? ` ×${first.qty}` : ''}`
    )
  }

  const customers = new Map<string, { name: string; email: string }>()
  for (const row of addressRows) {
    customers.set(row.orderId, {
      name: [row.firstName, row.lastName].filter(Boolean).join(' '),
      email: row.email,
    })
  }
  return { items, customers }
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>

export async function getDashboardStats() {
  const now = new Date()
  const d30 = new Date(now.getTime() - 30 * DAY)
  const d60 = new Date(now.getTime() - 60 * DAY)
  const seriesStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)
  const inPeriod = gte(orders.createdAt, d30)
  const revenueInPeriod = and(inPeriod, inArray(orders.status, [...REVENUE_STATUSES]))

  const [
    current, previous, series, statusRows, topProducts, paymentSplit, txStatusRows,
    capturedRow, codOutstandingRow, shipmentRows, openCartsRow, inProgressRow,
    recentRows, toShipQueue, awaitingQueue, failedPayments, catalog,
  ] = await Promise.all([
    getRevenueBetween(d30),
    getRevenueBetween(d60, d30),
    db.select({
        day: sql<string>`DATE(${orders.createdAt})`,
        revenue: sql<string>`COALESCE(SUM(${orders.totalCents}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(orders)
      .where(and(gte(orders.createdAt, seriesStart), inArray(orders.status, [...REVENUE_STATUSES])))
      .groupBy(sql`DATE(${orders.createdAt})`),
    db.select({ status: orders.status, count: sql<number>`COUNT(*)` })
      .from(orders).where(inPeriod).groupBy(orders.status),
    db.select({
        productId: orderItems.productId,
        name: orderItems.name,
        qty: sql<string>`SUM(${orderItems.qty})`,
        revenue: sql<string>`SUM(${orderItems.qty} * ${orderItems.priceCents})`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(revenueInPeriod)
      .groupBy(orderItems.productId, orderItems.name)
      .orderBy(desc(sql`SUM(${orderItems.qty})`))
      .limit(5),
    db.select({
        method: orders.paymentMethod,
        revenue: sql<string>`COALESCE(SUM(${orders.totalCents}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(orders).where(revenueInPeriod).groupBy(orders.paymentMethod),
    db.select({ status: paymentTransactions.status, count: sql<number>`COUNT(*)` })
      .from(paymentTransactions)
      .where(gte(paymentTransactions.createdAt, d30))
      .groupBy(paymentTransactions.status),
    db.select({ amount: sql<string>`COALESCE(SUM(${paymentTransactions.amountCents}), 0)` })
      .from(paymentTransactions)
      .where(and(eq(paymentTransactions.status, 'success'), gte(paymentTransactions.createdAt, d30))),
    // za pobraniem: pieniądze są u kuriera, dopóki paczka nie zostanie doręczona
    db.select({
        amount: sql<string>`COALESCE(SUM(${orders.totalCents}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(orders)
      .where(and(inPeriod, eq(orders.paymentMethod, 'cod'), inArray(orders.status, ['processing', 'shipped']))),
    db.select({ status: shipments.status, count: sql<number>`COUNT(*)` })
      .from(shipments).where(gte(shipments.createdAt, d30)).groupBy(shipments.status),
    db.select({ count: sql<number>`COUNT(DISTINCT ${cartItems.ownerId})` })
      .from(cartItems).where(gte(cartItems.addedAt, d30)),
    db.select({ count: sql<number>`COUNT(*)` })
      .from(orders).where(eq(orders.status, 'processing')),
    db.select({
        id: orders.id, status: orders.status, paymentMethod: orders.paymentMethod,
        totalCents: orders.totalCents, createdAt: orders.createdAt,
      })
      .from(orders).orderBy(desc(orders.createdAt)).limit(12),
    db.select({ id: orders.id, totalCents: orders.totalCents, createdAt: orders.createdAt, status: orders.status })
      .from(orders)
      .leftJoin(shipments, eq(shipments.orderId, orders.id))
      .where(toShipCondition())
      .orderBy(orders.createdAt)
      .limit(5),
    db.select({ id: orders.id, totalCents: orders.totalCents, createdAt: orders.createdAt, status: orders.status })
      .from(orders)
      .where(inArray(orders.status, ['pending', 'awaiting_payment']))
      .orderBy(desc(orders.createdAt))
      .limit(5),
    db.select({
        id: paymentTransactions.id, orderId: paymentTransactions.orderId,
        provider: paymentTransactions.provider, amountCents: paymentTransactions.amountCents,
        createdAt: paymentTransactions.createdAt,
      })
      .from(paymentTransactions)
      .where(eq(paymentTransactions.status, 'failed'))
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(5),
    listAdminProducts().catch((error) => {
      console.error('[dashboard] katalog Sanity niedostępny:', error)
      return null
    }),
  ])

  // seria dzienna z uzupełnionymi lukami (dni bez sprzedaży = 0)
  const byDay = new Map(series.map((row) => [normalizeDay(row.day), row]))
  const daily = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(seriesStart.getFullYear(), seriesStart.getMonth(), seriesStart.getDate() + index)
    const key = dayKey(date)
    const row = byDay.get(key)
    return { date: key, revenue: num(row?.revenue) / 100, count: num(row?.count) }
  })

  const { items, customers } = await describeOrders([
    ...recentRows.map((row) => row.id),
  ])
  const recentOrders: RecentOrder[] = recentRows.map((row) => ({
    ...row,
    customer: customers.get(row.id)?.name || customers.get(row.id)?.email || '—',
    itemSummary: items.get(row.id) ?? '',
  }))

  const openCarts = num(openCartsRow[0]?.count)
  const lowStock = (catalog ?? [])
    .filter((product) => product.status !== 'draft' && product.lowStock.length > 0)
    .slice(0, 6)

  return {
    revenueCents: current.revenueCents,
    revenueChangePct: changePctOrNull(current.revenueCents, previous.revenueCents),
    orderCount: current.count,
    orderCountChangePct: changePctOrNull(current.count, previous.count),
    averageOrderCents: current.count ? Math.round(current.revenueCents / current.count) : 0,
    shippingRevenueCents: current.shippingCents,
    capturedCents: num(capturedRow[0]?.amount),
    codOutstandingCents: num(codOutstandingRow[0]?.amount),
    codOutstandingCount: num(codOutstandingRow[0]?.count),
    openCarts,
    cartConversionPct:
      current.count + openCarts > 0 ? Math.round((current.count / (current.count + openCarts)) * 1000) / 10 : null,
    inProgress: num(inProgressRow[0]?.count),
    catalog: catalog
      ? {
          total: catalog.length,
          published: catalog.filter((p) => p.status !== 'draft').length,
          drafts: catalog.filter((p) => p.status === 'draft').length,
          changed: catalog.filter((p) => p.status === 'changed').length,
        }
      : null,
    daily,
    statuses: Object.fromEntries(statusRows.map((row) => [row.status, num(row.count)])) as Record<string, number>,
    paymentStatuses: Object.fromEntries(txStatusRows.map((row) => [row.status, num(row.count)])) as Record<string, number>,
    paymentMethods: paymentSplit.map((row) => ({
      method: row.method, revenueCents: num(row.revenue), count: num(row.count),
    })),
    shipmentStatuses: Object.fromEntries(shipmentRows.map((row) => [row.status, num(row.count)])) as Record<string, number>,
    topProducts: topProducts.map((row) => ({
      productId: row.productId, name: row.name, qty: num(row.qty), revenueCents: num(row.revenue),
    })),
    recentOrders,
    toShipQueue,
    awaitingQueue,
    failedPayments,
    lowStock,
  }
}

function changePctOrNull(current: number, previous: number): number | null {
  if (!previous) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}
