'use server'

import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import {
  orders, orderItems, shippingAddresses, paymentTransactions, shipments,
} from '@/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { resolveOrderAccess } from '@/lib/orderAccess'

// ─── customer queries ─────────────────────────────────────────────────────────

export async function getMyOrders() {
  const { userId } = await auth()
  if (!userId) return []

  return db
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
