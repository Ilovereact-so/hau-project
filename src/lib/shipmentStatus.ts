import 'server-only'
import { eq, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orders, shipments, type ShipmentStatus } from '@/db/schema'
import { getLatestTracking, getShipment, NOT_ORDERED_STATES } from '@/lib/furgonetka'
import { TRACKING_STATE_MAP, shouldApplyStatus } from '@/lib/furgonetkaWebhook'

/*
 * Wspólne nakładanie stanu przesyłki z Furgonetki (webhook, otwarcie
 * zamówienia w panelu i „Odśwież status”). Przesyłka nigdy się nie cofa, a zamówienie przechodzi
 * na „wysłane” po odbiorze przez kuriera i na „doręczone” po doręczeniu —
 * tylko ze stanów, z których to ma sens (anulowane/zwrócone zostają).
 */

const ORDER_SHIPPED_FROM = ['paid', 'processing']
const ORDER_DELIVERED_FROM = ['paid', 'processing', 'shipped']

export type FurgonetkaShipmentRow = { id: string; orderId: string; status: string }

export async function findShipmentByFurgonetka(packageId: string, packageNo?: string): Promise<FurgonetkaShipmentRow | null> {
  if (!packageId && !packageNo) return null
  const where =
    packageId && packageNo
      ? or(eq(shipments.furgonetkaId, packageId), eq(shipments.trackingNumber, packageNo))
      : packageId
        ? eq(shipments.furgonetkaId, packageId)
        : eq(shipments.trackingNumber, packageNo!)
  const [row] = await db
    .select({ id: shipments.id, orderId: shipments.orderId, status: shipments.status })
    .from(shipments)
    .where(where)
  return row ?? null
}

/** Zwraca `true`, gdy status przesyłki się zmienił. */
export async function applyShipmentState(
  shipment: FurgonetkaShipmentRow,
  next: ShipmentStatus | null,
  packageNo?: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const patch: { status?: ShipmentStatus; trackingNumber?: string } = {}
    if (next && shouldApplyStatus(shipment.status, next)) patch.status = next
    if (packageNo) patch.trackingNumber = packageNo.slice(0, 128)
    if (Object.keys(patch).length) {
      await tx.update(shipments).set(patch).where(eq(shipments.id, shipment.id))
    }
    if (!patch.status) return false

    const [order] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, shipment.orderId))
    if (!order) return true
    if (next === 'delivered' && ORDER_DELIVERED_FROM.includes(order.status)) {
      await tx.update(orders).set({ status: 'delivered' }).where(eq(orders.id, shipment.orderId))
    } else if (
      (next === 'picked_up' || next === 'in_transit' || next === 'out_for_delivery') &&
      ORDER_SHIPPED_FROM.includes(order.status)
    ) {
      await tx.update(orders).set({ status: 'shipped' }).where(eq(orders.id, shipment.orderId))
    }
    return true
  })
}

export type FurgonetkaSyncResult =
  | { kind: 'waiting' }
  | { kind: 'cancelled' }
  | { kind: 'ordered'; changed: boolean; latest: { state: string; description: string } | null }

/**
 * Stan przesyłki z Furgonetki na żądanie (otwarcie zamówienia w panelu,
 * „Odśwież status”). Zamówiona = opłacona w koszyku Furgonetki: ma numer
 * listu przewozowego — dopiero wtedy panel odblokowuje etykietę.
 */
export async function syncFurgonetkaShipment(shipment: FurgonetkaShipmentRow & { furgonetkaId: string }): Promise<FurgonetkaSyncResult> {
  const info = await getShipment(shipment.furgonetkaId)
  if (info.state === 'cancelled') return { kind: 'cancelled' }
  const waybill = info.waybills[0]
  if (!waybill || (info.state && NOT_ORDERED_STATES.includes(info.state))) return { kind: 'waiting' }

  const latest = await getLatestTracking(shipment.furgonetkaId).catch(() => null)
  const next = latest ? TRACKING_STATE_MAP[latest.state] ?? null : null
  const changed = await applyShipmentState(shipment, next, waybill)
  return { kind: 'ordered', changed, latest }
}
