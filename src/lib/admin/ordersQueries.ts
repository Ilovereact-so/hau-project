import 'server-only'
import { and, desc, eq, gte, inArray, lt, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  cartItems, newsletterSubscribers, orderItems, orders, paymentTransactions, savedAddresses,
  shipments, shippingAddresses, wishlistItems,
  ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_TX_STATUSES,
} from '@/db/schema'
import { describeOrders, getRevenueBetween, REVENUE_STATUSES } from './dashboardQueries'

const num = (v: unknown) => Number(v ?? 0)
const DAY = 86400_000

function parseDay(value: string | undefined, endOfDay = false): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d + (endOfDay ? 1 : 0))
  return Number.isNaN(date.getTime()) ? null : date
}

/** Wzorzec LIKE z ucieczką znaków specjalnych — wpisany `%` nie może dopasować wszystkiego. */
function likePattern(value: string) {
  return `%${value.trim().replace(/[\\%_]/g, (match) => `\\${match}`)}%`
}

// ─── zamówienia ───────────────────────────────────────────────────────────────

export type AdminOrdersFilter = {
  status?: string
  method?: string
  q?: string
  from?: string
  to?: string
  days?: number
  sort?: 'date' | 'value'
  page?: number
  limit?: number
}

export type AdminOrderRow = {
  id: string
  status: string
  paymentMethod: string
  shippingMethod: string
  totalCents: number
  discountCode: string | null
  userId: string
  createdAt: Date | null
  customerName: string
  email: string
  itemSummary: string
  paymentStatus: string | null
  shipmentStatus: string | null
  trackingNumber: string | null
}

export async function getAdminOrders(filter: AdminOrdersFilter = {}) {
  const limit = Math.min(Math.max(filter.limit ?? 20, 5), 100)
  const page = Math.max(filter.page ?? 1, 1)

  const conds: SQL[] = []
  if (filter.status && (ORDER_STATUSES as readonly string[]).includes(filter.status)) {
    conds.push(eq(orders.status, filter.status as (typeof ORDER_STATUSES)[number]))
  }
  if (filter.method && (PAYMENT_METHODS as readonly string[]).includes(filter.method)) {
    conds.push(eq(orders.paymentMethod, filter.method as (typeof PAYMENT_METHODS)[number]))
  }
  const from = parseDay(filter.from)
  if (from) conds.push(gte(orders.createdAt, from))
  const to = parseDay(filter.to, true) // „do” włącznie z całym dniem
  if (to) conds.push(lt(orders.createdAt, to))
  if (!from && filter.days && filter.days > 0) {
    conds.push(gte(orders.createdAt, new Date(Date.now() - filter.days * DAY)))
  }
  if (filter.q?.trim()) {
    const like = likePattern(filter.q)
    const compactId = filter.q.trim().replace(/^#/, '')
    conds.push(
      or(
        sql`REPLACE(${orders.id}, '-', '') LIKE ${likePattern(compactId.replace(/-/g, ''))}`,
        sql`${orders.guestEmail} LIKE ${like}`,
        sql`${orders.userId} LIKE ${like}`,
        sql`${orders.discountCode} LIKE ${like}`,
        sql`EXISTS (SELECT 1 FROM ${shippingAddresses} sa WHERE sa.order_id = ${orders.id} AND (
          sa.email LIKE ${like} OR CONCAT(sa.first_name, ' ', sa.last_name) LIKE ${like} OR sa.phone LIKE ${like}
        ))`,
        sql`EXISTS (SELECT 1 FROM ${orderItems} oi WHERE oi.order_id = ${orders.id} AND oi.name LIKE ${like})`
      )!
    )
  }
  const where = conds.length ? and(...conds) : undefined

  const [rows, [countRow]] = await Promise.all([
    db.select({
        id: orders.id, status: orders.status, paymentMethod: orders.paymentMethod,
        shippingMethod: orders.shippingMethod, totalCents: orders.totalCents,
        discountCode: orders.discountCode, guestEmail: orders.guestEmail,
        userId: orders.userId, createdAt: orders.createdAt,
      })
      .from(orders)
      .where(where)
      .orderBy(filter.sort === 'value' ? desc(orders.totalCents) : desc(orders.createdAt), desc(orders.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ count: sql<number>`COUNT(*)` }).from(orders).where(where),
  ])

  const ids = rows.map((row) => row.id)
  const [{ items, customers }, txRows, shipmentRows] = await Promise.all([
    describeOrders(ids),
    ids.length
      ? db.select({
            orderId: paymentTransactions.orderId,
            status: paymentTransactions.status,
            createdAt: paymentTransactions.createdAt,
          })
          .from(paymentTransactions)
          .where(inArray(paymentTransactions.orderId, ids))
          .orderBy(desc(paymentTransactions.createdAt))
      : Promise.resolve([]),
    ids.length
      ? db.select({
            orderId: shipments.orderId,
            status: shipments.status,
            trackingNumber: shipments.trackingNumber,
          })
          .from(shipments)
          .where(inArray(shipments.orderId, ids))
      : Promise.resolve([]),
  ])

  const lastTx = new Map<string, string>()
  for (const tx of txRows) if (!lastTx.has(tx.orderId)) lastTx.set(tx.orderId, tx.status)
  const shipmentByOrder = new Map(shipmentRows.map((row) => [row.orderId, row]))

  const result: AdminOrderRow[] = rows.map((row) => {
    const customer = customers.get(row.id)
    return {
      id: row.id,
      status: row.status,
      paymentMethod: row.paymentMethod,
      shippingMethod: row.shippingMethod,
      totalCents: row.totalCents,
      discountCode: row.discountCode,
      userId: row.userId,
      createdAt: row.createdAt,
      customerName: customer?.name ?? '',
      email: customer?.email || row.guestEmail || '',
      itemSummary: items.get(row.id) ?? '',
      paymentStatus: lastTx.get(row.id) ?? null,
      shipmentStatus: shipmentByOrder.get(row.id)?.status ?? null,
      trackingNumber: shipmentByOrder.get(row.id)?.trackingNumber ?? null,
    }
  })

  return { rows: result, total: num(countRow?.count), page, limit }
}

export async function getAdminOrderDetail(orderId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
  if (!order) return null
  const [items, addressRows, payments, shipmentRows, customerOrders] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db.select().from(shippingAddresses).where(eq(shippingAddresses.orderId, orderId)).limit(1),
    db.select({
        id: paymentTransactions.id,
        provider: paymentTransactions.provider,
        externalId: paymentTransactions.externalId,
        status: paymentTransactions.status,
        amountCents: paymentTransactions.amountCents,
        createdAt: paymentTransactions.createdAt,
        updatedAt: paymentTransactions.updatedAt,
      })
      .from(paymentTransactions)
      .where(eq(paymentTransactions.orderId, orderId))
      .orderBy(desc(paymentTransactions.createdAt)),
    db.select().from(shipments).where(eq(shipments.orderId, orderId)).limit(1),
    db.select({ count: sql<number>`COUNT(*)` }).from(orders).where(eq(orders.userId, order.userId)),
  ])
  return {
    order,
    items,
    address: addressRows[0] ?? null,
    payments,
    shipment: shipmentRows[0] ?? null,
    customerOrderCount: num(customerOrders[0]?.count),
  }
}

// ─── klienci ──────────────────────────────────────────────────────────────────

export type AdminCustomer = {
  userId: string
  isGuest: boolean
  name: string
  email: string
  phone: string
  city: string
  ordersCount: number
  paidOrders: number
  ltvCents: number
  lastOrder: string | null
}

export async function getAdminCustomers({ q, limit = 100 }: { q?: string; limit?: number } = {}) {
  const like = q?.trim() ? likePattern(q) : null
  const where = like
    ? or(
        sql`${orders.userId} LIKE ${like}`,
        sql`${orders.guestEmail} LIKE ${like}`,
        sql`EXISTS (SELECT 1 FROM ${shippingAddresses} sa WHERE sa.order_id = ${orders.id} AND (
          sa.email LIKE ${like} OR CONCAT(sa.first_name, ' ', sa.last_name) LIKE ${like} OR sa.phone LIKE ${like}
        ))`
      )
    : undefined

  const rows = await db
    .select({
      userId: orders.userId,
      ordersCount: sql<number>`COUNT(*)`,
      paidOrders: sql<number>`SUM(CASE WHEN ${inArray(orders.status, [...REVENUE_STATUSES])} THEN 1 ELSE 0 END)`,
      ltv: sql<string>`COALESCE(SUM(CASE WHEN ${inArray(orders.status, [...REVENUE_STATUSES])} THEN ${orders.totalCents} ELSE 0 END), 0)`,
      lastOrder: sql<string>`MAX(${orders.createdAt})`,
      lastOrderId: sql<string>`SUBSTRING_INDEX(GROUP_CONCAT(${orders.id} ORDER BY ${orders.createdAt} DESC), ',', 1)`,
      guestEmail: sql<string>`MAX(${orders.guestEmail})`,
    })
    .from(orders)
    .where(where)
    .groupBy(orders.userId)
    .orderBy(desc(sql`COALESCE(SUM(CASE WHEN ${inArray(orders.status, [...REVENUE_STATUSES])} THEN ${orders.totalCents} ELSE 0 END), 0)`))
    .limit(Math.min(Math.max(limit, 1), 500))

  const lastIds = rows.map((row) => row.lastOrderId).filter(Boolean)
  const addresses = lastIds.length
    ? await db
        .select({
          orderId: shippingAddresses.orderId,
          firstName: shippingAddresses.firstName,
          lastName: shippingAddresses.lastName,
          email: shippingAddresses.email,
          phone: shippingAddresses.phone,
          city: shippingAddresses.city,
          pickupPointName: shippingAddresses.pickupPointName,
        })
        .from(shippingAddresses)
        .where(inArray(shippingAddresses.orderId, lastIds))
    : []
  const byOrder = new Map(addresses.map((row) => [row.orderId, row]))

  return rows.map((row): AdminCustomer => {
    const address = byOrder.get(row.lastOrderId)
    const isGuest = !row.userId.startsWith('user_')
    return {
      userId: row.userId,
      isGuest,
      name: address ? [address.firstName, address.lastName].filter(Boolean).join(' ') : '',
      email: address?.email || row.guestEmail || '',
      phone: address?.phone ?? '',
      city: address?.city || (address?.pickupPointName ? 'Paczkomat' : ''),
      ordersCount: num(row.ordersCount),
      paidOrders: num(row.paidOrders),
      ltvCents: num(row.ltv),
      lastOrder: row.lastOrder ? String(row.lastOrder) : null,
    }
  })
}

export async function getCustomerOrders(userId: string) {
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(20)
}

export async function getCustomerSavedAddress(userId: string) {
  const [row] = await db.select().from(savedAddresses).where(eq(savedAddresses.userId, userId)).limit(1)
  return row ?? null
}

// ─── płatności ────────────────────────────────────────────────────────────────

export const PAYMENT_PROVIDERS = ['autopay', 'przelewy24'] as const

export async function getAdminPayments(filter: { status?: string; provider?: string; page?: number } = {}) {
  const limit = 20
  const page = Math.max(filter.page ?? 1, 1)
  const conds: SQL[] = []
  if (filter.status && (PAYMENT_TX_STATUSES as readonly string[]).includes(filter.status)) {
    conds.push(eq(paymentTransactions.status, filter.status as (typeof PAYMENT_TX_STATUSES)[number]))
  }
  if (filter.provider && (PAYMENT_PROVIDERS as readonly string[]).includes(filter.provider)) {
    conds.push(eq(paymentTransactions.provider, filter.provider as (typeof PAYMENT_PROVIDERS)[number]))
  }
  const where = conds.length ? and(...conds) : undefined
  const d30 = new Date(Date.now() - 30 * DAY)

  const [rows, [countRow], summary] = await Promise.all([
    db.select({
        id: paymentTransactions.id,
        orderId: paymentTransactions.orderId,
        provider: paymentTransactions.provider,
        externalId: paymentTransactions.externalId,
        status: paymentTransactions.status,
        amountCents: paymentTransactions.amountCents,
        createdAt: paymentTransactions.createdAt,
        updatedAt: paymentTransactions.updatedAt,
        orderStatus: orders.status,
      })
      .from(paymentTransactions)
      .leftJoin(orders, eq(orders.id, paymentTransactions.orderId))
      .where(where)
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ count: sql<number>`COUNT(*)` }).from(paymentTransactions).where(where),
    db.select({
        status: paymentTransactions.status,
        count: sql<number>`COUNT(*)`,
        amount: sql<string>`COALESCE(SUM(${paymentTransactions.amountCents}), 0)`,
      })
      .from(paymentTransactions)
      .where(gte(paymentTransactions.createdAt, d30))
      .groupBy(paymentTransactions.status),
  ])

  const byStatus = Object.fromEntries(
    summary.map((row) => [row.status, { count: num(row.count), amountCents: num(row.amount) }])
  ) as Record<string, { count: number; amountCents: number }>

  return { rows, total: num(countRow?.count), page, limit, summary30: byStatus }
}

// ─── newsletter ───────────────────────────────────────────────────────────────

export async function getNewsletterStats() {
  const d30 = new Date(Date.now() - 30 * DAY)
  const [[totals], recent] = await Promise.all([
    db.select({
        active: sql<number>`SUM(CASE WHEN ${newsletterSubscribers.isActive} THEN 1 ELSE 0 END)`,
        // Zapis bez kliknięcia linku potwierdzającego (double opt-in).
        pending: sql<number>`SUM(CASE WHEN NOT ${newsletterSubscribers.isActive} AND ${newsletterSubscribers.confirmedAt} IS NULL THEN 1 ELSE 0 END)`,
        inactive: sql<number>`SUM(CASE WHEN NOT ${newsletterSubscribers.isActive} AND ${newsletterSubscribers.confirmedAt} IS NOT NULL THEN 1 ELSE 0 END)`,
        last30: sql<number>`SUM(CASE WHEN ${newsletterSubscribers.createdAt} >= ${d30} THEN 1 ELSE 0 END)`,
      })
      .from(newsletterSubscribers),
    db.select({
        id: newsletterSubscribers.id,
        email: newsletterSubscribers.email,
        isActive: newsletterSubscribers.isActive,
        confirmedAt: newsletterSubscribers.confirmedAt,
        createdAt: newsletterSubscribers.createdAt,
      })
      .from(newsletterSubscribers)
      .orderBy(desc(newsletterSubscribers.createdAt))
      .limit(50),
  ])
  return {
    active: num(totals?.active),
    pending: num(totals?.pending),
    inactive: num(totals?.inactive),
    last30: num(totals?.last30),
    recent,
  }
}

// ─── analityka (insights) ─────────────────────────────────────────────────────

export async function getInsights() {
  const d30 = new Date(Date.now() - 30 * DAY)
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  // porównujemy równe odcinki: 1..N dzień poprzedniego miesiąca vs 1..N bieżącego
  const prevMonthSameDay = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate() + 1)
  const prevCutoff = prevMonthSameDay < thisMonthStart ? prevMonthSameDay : thisMonthStart

  const [wishlistTop, abandonedCarts, byHour, byDow, productSales, current, previous, previousFull] = await Promise.all([
    db.select({
        productId: wishlistItems.productId,
        wishlistCount: sql<number>`COUNT(*)`,
      })
      .from(wishlistItems)
      .groupBy(wishlistItems.productId)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10),
    db.select({
        ownerId: cartItems.ownerId,
        items: sql<number>`SUM(${cartItems.qty})`,
        lines: sql<number>`COUNT(*)`,
        lastAdded: sql<string>`MAX(${cartItems.addedAt})`,
      })
      .from(cartItems)
      .groupBy(cartItems.ownerId)
      .orderBy(desc(sql`MAX(${cartItems.addedAt})`))
      .limit(10),
    db.select({ hour: sql<number>`HOUR(${orders.createdAt})`, count: sql<number>`COUNT(*)` })
      .from(orders).where(gte(orders.createdAt, d30)).groupBy(sql`HOUR(${orders.createdAt})`),
    db.select({ dow: sql<number>`DAYOFWEEK(${orders.createdAt})`, count: sql<number>`COUNT(*)` })
      .from(orders).where(gte(orders.createdAt, d30)).groupBy(sql`DAYOFWEEK(${orders.createdAt})`),
    db.select({
        productId: orderItems.productId, name: orderItems.name,
        qty: sql<string>`SUM(${orderItems.qty})`,
        revenue: sql<string>`SUM(${orderItems.qty} * ${orderItems.priceCents})`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(gte(orders.createdAt, d30), inArray(orders.status, [...REVENUE_STATUSES])))
      .groupBy(orderItems.productId, orderItems.name)
      .orderBy(desc(sql`SUM(${orderItems.qty})`))
      .limit(15),
    getRevenueBetween(thisMonthStart),
    getRevenueBetween(prevMonthStart, prevCutoff),
    getRevenueBetween(prevMonthStart, thisMonthStart),
  ])

  return {
    wishlistTop: wishlistTop.map((r) => ({ productId: r.productId, count: num(r.wishlistCount) })),
    abandonedCarts: abandonedCarts.map((r) => ({
      ownerId: r.ownerId, items: num(r.items), lines: num(r.lines), lastAdded: r.lastAdded,
    })),
    byHour: byHour.map((r) => ({ hour: num(r.hour), count: num(r.count) })),
    byDow: byDow.map((r) => ({ dow: num(r.dow), count: num(r.count) })),
    productSales: productSales.map((r) => ({
      productId: r.productId, name: r.name, qty: num(r.qty), revenueCents: num(r.revenue),
    })),
    monthCompare: { current, previous, previousFull },
  }
}
