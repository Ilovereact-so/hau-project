'use server'

import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import {
  orders, orderItems, shippingAddresses, paymentTransactions, shipments,
} from '@/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { createShipment, getShipmentLabel } from '@/lib/furgonetka'
import type { FurgonetkaAddress, FurgonetkaParcel } from '@/lib/furgonetka'

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

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))

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

// ─── admin: create shipment ───────────────────────────────────────────────────

export interface CreateShipmentInput {
  orderId:  string
  service:  string
  parcel:   FurgonetkaParcel
}

export async function adminCreateShipment(input: CreateShipmentInput) {
  const { userId, sessionClaims } = await auth()
  if (!userId) throw new Error('Unauthorized')
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') throw new Error('Forbidden')

  const [order] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.id, input.orderId))

  if (!order) throw new Error('Order not found')
  if (order.status !== 'paid' && order.status !== 'processing') {
    throw new Error(`Cannot ship order in status: ${order.status}`)
  }

  const [address] = await db
    .select()
    .from(shippingAddresses)
    .where(eq(shippingAddresses.orderId, input.orderId))

  if (!address) throw new Error('Shipping address not found')

  const recipient: FurgonetkaAddress = {
    firstName:  address.firstName,
    lastName:   address.lastName,
    email:      address.email,
    phone:      address.phone,
    street:     address.street ?? '',
    city:       address.city ?? '',
    postalCode: address.postalCode ?? '',
    country:    'PL',
  }

  const result = await createShipment({
    service:     input.service,
    parcel:      input.parcel,
    recipient,
    reference:   input.orderId,
    description: `Zamówienie #${input.orderId.slice(0, 8).toUpperCase()}`,
  })

  const shipmentId = crypto.randomUUID()

  await db.transaction(async tx => {
    await tx.insert(shipments).values({
      id:             shipmentId,
      orderId:        input.orderId,
      furgonetkaId:   result.id,
      carrier:        result.carrier,
      service:        input.service,
      trackingNumber: result.trackingNumber ?? undefined,
      status:         'created',
      parcelWeightG:  Math.round(input.parcel.weightKg * 1000),
    })

    await tx
      .update(orders)
      .set({ status: 'processing' })
      .where(eq(orders.id, input.orderId))
  })

  return { shipmentId, furgonetkaId: result.id }
}

// ─── admin: get label ─────────────────────────────────────────────────────────

export async function adminGetShipmentLabel(orderId: string): Promise<string> {
  const { userId, sessionClaims } = await auth()
  if (!userId) throw new Error('Unauthorized')
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') throw new Error('Forbidden')

  const [shipment] = await db
    .select({ furgonetkaId: shipments.furgonetkaId, labelUrl: shipments.labelUrl })
    .from(shipments)
    .where(eq(shipments.orderId, orderId))

  if (!shipment?.furgonetkaId) throw new Error('No shipment for this order')

  if (shipment.labelUrl) return shipment.labelUrl

  const labelUrl = await getShipmentLabel(shipment.furgonetkaId)

  await db
    .update(shipments)
    .set({ labelUrl })
    .where(eq(shipments.orderId, orderId))

  return labelUrl
}

// ─── admin: update order status ───────────────────────────────────────────────

export async function adminUpdateOrderStatus(
  orderId: string,
  status: 'processing' | 'cancelled' | 'refunded',
) {
  const { userId, sessionClaims } = await auth()
  if (!userId) throw new Error('Unauthorized')
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') throw new Error('Forbidden')

  await db.update(orders).set({ status }).where(eq(orders.id, orderId))
}

// ─── admin: list all orders ───────────────────────────────────────────────────

export async function adminGetOrders(page = 1, limit = 50) {
  const { userId, sessionClaims } = await auth()
  if (!userId) throw new Error('Unauthorized')
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') throw new Error('Forbidden')

  const offset = (page - 1) * limit

  return db
    .select({
      id:            orders.id,
      userId:        orders.userId,
      guestEmail:    orders.guestEmail,
      status:        orders.status,
      paymentMethod: orders.paymentMethod,
      totalCents:    orders.totalCents,
      createdAt:     orders.createdAt,
    })
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset)
}
