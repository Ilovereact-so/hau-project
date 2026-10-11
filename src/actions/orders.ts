'use server'

import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import {
  orders, orderItems, shippingAddresses, paymentTransactions, shipments,
} from '@/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { guestOrderPath, resolveOrderAccess } from '@/lib/orderAccess'
import { readGuestId } from '@/lib/cartServer'
import { expireIfOverdue, orderPaymentDeadline } from '@/lib/unpaidOrders.server'
import { isPaymentOverdue } from '@/lib/paymentDeadline'

// ─── customer queries ─────────────────────────────────────────────────────────

export async function getMyOrders() {
  const { userId } = await auth()
  if (!userId) return []

  const rows = await db
    .select({
      id:             orders.id,
      status:         orders.status,
      paymentMethod:  orders.paymentMethod,
      shippingMethod: orders.shippingMethod,
      totalCents:     orders.totalCents,
      shippingCents:  orders.shippingCents,
      discountCents:  orders.discountCents,
      createdAt:      orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))

  // Nieopłacone po terminie anulujemy przy odczycie (cron mógł jeszcze nie
  // zdążyć), a czekającym dokładamy termin — lista pokazuje „Zapłać do …”.
  return Promise.all(rows.map(async (row) => {
    const status = await expireIfOverdue(row)
    return {
      ...row,
      status: status as typeof row.status,
      paymentDeadline: status === 'awaiting_payment' ? orderPaymentDeadline(row.createdAt).toISOString() : null,
    }
  }))
}

export async function getOrderDetail(orderId: string) {
  const { userId } = await auth()
  if (!userId) return null
  return loadOrderDetail(orderId, userId)
}

/**
 * Szczegóły zamówienia dla właściciela `ownerId` (userId konta albo
 * `guest_…`). NIE sprawdza sesji — wołający musi rozstrzygnąć dostęp
 * (profil: zalogowany user; strona gościa: lib/orderAccess.ts).
 */
async function loadOrderDetail(orderId: string, ownerId: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, ownerId)))

  if (!order) return null

  // Po terminie płatności — anulujemy od razu (nie czekamy na cron).
  order.status = (await expireIfOverdue(order)) as typeof order.status

  const [items, address, payment, shipment] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db.select().from(shippingAddresses).where(eq(shippingAddresses.orderId, orderId)),
    db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.orderId, orderId))
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(1),
    db.select().from(shipments).where(eq(shipments.orderId, orderId)).limit(1),
  ])

  return {
    order,
    items,
    address:  address[0] ?? null,
    payment:  payment[0] ?? null,
    shipment: shipment[0] ?? null,
    /** Termin płatności (ISO) — tylko dla zamówień czekających na płatność online. */
    paymentDeadline: order.status === 'awaiting_payment' && order.paymentMethod === 'autopay'
      ? orderPaymentDeadline(order.createdAt).toISOString()
      : null,
  }
}

/** Zamówienie gościa — dostęp sprawdzony wcześniej przez `resolveOrderAccess`. */
export async function getGuestOrderDetail(orderId: string, token?: string | null) {
  const { access, ownerId } = await resolveOrderAccess(orderId, token)
  if (!access || !ownerId) return null
  return loadOrderDetail(orderId, ownerId)
}

// Akcje panelu admina (przesyłki, zmiana statusu, lista) mieszkają w
// `src/actions/adminOrders.ts` — z walidacją przejść statusów.

// ─── nieopłacone zamówienie (pusty koszyk / kasa) ─────────────────────────────

export interface PendingPaymentOrder {
  id:          string
  number:      string
  totalCents:  number
  deadline:    string
  /** Strona zamówienia z sekcją „Zapłać” (profil albo strona gościa z tokenem). */
  href:        string
}

/**
 * Najnowsze zamówienie bieżącego klienta, które czeka na płatność online i
 * jeszcze nie minął jego termin. Pusty koszyk i kasa pokazują je z przyciskiem
 * „Zapłać” — klient, który zamknął okno płatności albo wrócił z banku, nie
 * zostaje z pustym koszykiem (tak robią Allegro czy empik).
 */
export async function getPendingPaymentOrder(): Promise<PendingPaymentOrder | null> {
  const { userId } = await auth()
  const ownerId = userId ?? (await readGuestId())
  if (!ownerId) return null

  const candidates = await db
    .select({ id: orders.id, totalCents: orders.totalCents, createdAt: orders.createdAt })
    .from(orders)
    .where(and(eq(orders.userId, ownerId), eq(orders.status, 'awaiting_payment'), eq(orders.paymentMethod, 'autopay')))
    .orderBy(desc(orders.createdAt))
    .limit(5)

  const latest = candidates.find((order) => !isPaymentOverdue(orderPaymentDeadline(order.createdAt)))
  if (!latest) return null

  return {
    id:         latest.id,
    number:     latest.id.slice(0, 8).toUpperCase(),
    totalCents: latest.totalCents,
    deadline:   orderPaymentDeadline(latest.createdAt).toISOString(),
    href:       userId ? `/profile/orders/${latest.id}#platnosc` : `${guestOrderPath(latest.id)}#platnosc`,
  }
}
