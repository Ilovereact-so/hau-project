'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orders, shipments, shippingAddresses, SHIPMENT_STATUSES, type OrderStatus, type ShipmentStatus } from '@/db/schema'
import {
  createShipment,
  getLatestTracking,
  getShipment,
  orderShipment,
  type FurgonetkaAddress,
  type FurgonetkaParcel,
} from '@/lib/furgonetka'
import { TRACKING_STATE_MAP } from '@/lib/furgonetkaWebhook'
import { applyShipmentState } from '@/lib/shipmentStatus'
import { runAdminAction, type ActionResult } from '@/lib/admin/guard'
import { ORDER_TRANSITIONS } from '@/lib/admin/labels'
import { releaseDiscountForOrder } from '@/lib/discountServer'

/*
 * Akcje zamówień w panelu admina.
 *
 * Każda zmiana statusu przechodzi przez `ORDER_TRANSITIONS` — wcześniej
 * dało się np. oznaczyć anulowane zamówienie jako doręczone.
 * UWAGA: „Zwrócone” zmienia wyłącznie status w sklepie. Zwrot pieniędzy
 * trzeba zlecić w panelu operatora (Autopay / Przelewy24).
 */

function refresh(orderId?: string) {
  revalidatePath('/admin', 'layout')
  if (orderId) revalidatePath(`/admin/orders/${orderId}`)
}

async function loadOrder(orderId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw new Error('Nieprawidłowy numer zamówienia.')
  const [order] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
  if (!order) throw new Error('Nie znaleziono zamówienia.')
  return order
}

export async function adminUpdateOrderStatus(orderId: string, status: OrderStatus): Promise<ActionResult> {
  return runAdminAction(async () => {
    const order = await loadOrder(orderId)
    const allowed = ORDER_TRANSITIONS[order.status] ?? []
    if (!allowed.includes(status)) {
      throw new Error(`Nie można zmienić statusu z „${order.status}” na „${status}”.`)
    }
    await db.transaction(async (tx) => {
      await tx.update(orders).set({ status }).where(eq(orders.id, orderId))
      // Anulowane zamówienie oddaje użycie kodu rabatowego (limity).
      // Zwrot („refunded”) NIE oddaje — rabat został wykorzystany.
      if (status === 'cancelled') await releaseDiscountForOrder(tx, orderId)
    })
    refresh(orderId)
    return null
  }, 'Nie udało się zmienić statusu.')
}

interface CreateShipmentInput {
  orderId: string
  service: string
  parcel: FurgonetkaParcel
}

function validateParcel(parcel: FurgonetkaParcel): FurgonetkaParcel {
  const values = [parcel.weightKg, parcel.widthCm, parcel.heightCm, parcel.depthCm]
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('Wymiary i waga paczki muszą być dodatnie.')
  }
  if (parcel.weightKg > 50) throw new Error('Waga paczki nie może przekraczać 50 kg.')
  return parcel
}

/** Przesyłka kurierska przez API Furgonetki (paczkomaty — patrz rejestracja ręczna). */
export async function adminCreateShipment(input: CreateShipmentInput): Promise<ActionResult<{ shipmentId: string }>> {
  return runAdminAction(async () => {
    const order = await loadOrder(input.orderId)
    if (order.status !== 'paid' && order.status !== 'processing') {
      throw new Error('Przesyłkę można utworzyć tylko dla zamówienia opłaconego lub w realizacji.')
    }
    const service = input.service.trim()
    if (!service) throw new Error('Podaj kod usługi Furgonetki.')
    const parcel = validateParcel(input.parcel)

    const [existing] = await db.select({ id: shipments.id }).from(shipments).where(eq(shipments.orderId, order.id))
    if (existing) throw new Error('To zamówienie ma już przesyłkę.')

    const [address] = await db.select().from(shippingAddresses).where(eq(shippingAddresses.orderId, order.id))
    if (!address) throw new Error('Zamówienie nie ma adresu dostawy.')
    if (address.pickupPointCode || !address.street) {
      throw new Error(
        'To zamówienie idzie do punktu odbioru — nadaj je w panelu Furgonetki i zarejestruj numer przesyłki ręcznie.'
      )
    }

    const recipient: FurgonetkaAddress = {
      firstName: address.firstName,
      lastName: address.lastName,
      email: address.email,
      phone: address.phone,
      street: [address.street, address.apartment_number].filter(Boolean).join(' / '),
      city: address.city ?? '',
      postalCode: address.postalCode ?? '',
      country: 'PL',
    }

    const result = await createShipment({
      service,
      parcel,
      recipient,
      reference: order.id,
      description: `Zamówienie #${order.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
    })

    const shipmentId = randomUUID()
    await db.transaction(async (tx) => {
      await tx.insert(shipments).values({
        id: shipmentId,
        orderId: order.id,
        furgonetkaId: result.id,
        carrier: result.carrier || service,
        service,
        trackingNumber: result.trackingNumber ?? undefined,
        status: 'created',
        parcelWeightG: Math.round(parcel.weightKg * 1000),
      })
      if (order.status === 'paid') {
        await tx.update(orders).set({ status: 'processing' }).where(eq(orders.id, order.id))
      }
    })

    refresh(order.id)

    // Utworzona przesyłka to dopiero szkic w Furgonetce — zamówienie zleca
    // kuriera i tworzy etykietę. Gdy się nie uda, przesyłka zostaje zapisana
    // i można ją zamówić ponownie przyciskiem „Zamów kuriera”.
    try {
      await orderAndSyncWaybill(shipmentId, result.id)
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      throw new Error(`Przesyłka utworzona w Furgonetce, ale nie zamówiona: ${reason} Popraw problem i kliknij „Zamów kuriera”.`)
    } finally {
      refresh(order.id)
    }
    return { shipmentId }
  }, 'Nie udało się utworzyć przesyłki w Furgonetce.')
}

/** Przesyłka nadana poza API (paczkomat, odbiór osobisty, inny przewoźnik). */
export async function adminRegisterShipment(input: {
  orderId: string
  carrier: string
  trackingNumber: string
  weightKg?: number
}): Promise<ActionResult> {
  return runAdminAction(async () => {
    const order = await loadOrder(input.orderId)
    if (!['paid', 'processing', 'shipped'].includes(order.status)) {
      throw new Error('Przesyłkę można dodać tylko do zamówienia opłaconego lub w realizacji.')
    }
    const carrier = input.carrier.trim().slice(0, 64)
    const trackingNumber = input.trackingNumber.trim().slice(0, 128)
    if (!carrier) throw new Error('Podaj przewoźnika.')
    if (!trackingNumber) throw new Error('Podaj numer przesyłki.')

    const [existing] = await db.select({ id: shipments.id }).from(shipments).where(eq(shipments.orderId, order.id))
    if (existing) throw new Error('To zamówienie ma już przesyłkę.')

    await db.transaction(async (tx) => {
      await tx.insert(shipments).values({
        id: randomUUID(),
        orderId: order.id,
        furgonetkaId: null,
        carrier,
        service: 'manual',
        trackingNumber,
        status: 'created',
        parcelWeightG: Math.max(0, Math.round((input.weightKg ?? 0) * 1000)),
      })
      if (order.status === 'paid') {
        await tx.update(orders).set({ status: 'processing' }).where(eq(orders.id, order.id))
      }
    })
    refresh(order.id)
    return null
  }, 'Nie udało się zarejestrować przesyłki.')
}

/**
 * Ręczna zmiana statusu przesyłki (dla nadanych poza API). Skutki dla
 * zamówienia — te same co w webhooku Furgonetki.
 */
export async function adminSetShipmentStatus(orderId: string, status: ShipmentStatus): Promise<ActionResult> {
  return runAdminAction(async () => {
    if (!(SHIPMENT_STATUSES as readonly string[]).includes(status)) throw new Error('Nieznany status przesyłki.')
    const order = await loadOrder(orderId)
    if (order.status === 'cancelled' || order.status === 'refunded') {
      throw new Error('Zamówienie jest zamknięte — status przesyłki nie ma już znaczenia.')
    }
    const [shipment] = await db.select({ id: shipments.id }).from(shipments).where(eq(shipments.orderId, order.id))
    if (!shipment) throw new Error('Zamówienie nie ma przesyłki.')

    await db.transaction(async (tx) => {
      await tx.update(shipments).set({ status }).where(eq(shipments.id, shipment.id))
      if (status === 'delivered') {
        await tx.update(orders).set({ status: 'delivered' }).where(eq(orders.id, order.id))
      } else if (['picked_up', 'in_transit', 'out_for_delivery'].includes(status) && order.status !== 'delivered') {
        await tx.update(orders).set({ status: 'shipped' }).where(eq(orders.id, order.id))
      }
    })
    refresh(order.id)
    return null
  }, 'Nie udało się zmienić statusu przesyłki.')
}

async function orderAndSyncWaybill(shipmentId: string, furgonetkaId: string) {
  await orderShipment(furgonetkaId)
  const info = await getShipment(furgonetkaId).catch(() => null)
  if (info?.waybills[0]) {
    await db.update(shipments).set({ trackingNumber: info.waybills[0].slice(0, 128) }).where(eq(shipments.id, shipmentId))
  }
}

async function loadFurgonetkaShipment(orderId: string) {
  const order = await loadOrder(orderId)
  const [shipment] = await db
    .select({ id: shipments.id, orderId: shipments.orderId, status: shipments.status, furgonetkaId: shipments.furgonetkaId, trackingNumber: shipments.trackingNumber })
    .from(shipments)
    .where(eq(shipments.orderId, order.id))
  if (!shipment) throw new Error('Zamówienie nie ma przesyłki.')
  if (!shipment.furgonetkaId) throw new Error('Przesyłka nadana poza Furgonetką.')
  return { ...shipment, furgonetkaId: shipment.furgonetkaId }
}

/** Ponowne zamówienie przesyłki, która powstała, ale nie została zamówiona. */
export async function adminOrderShipment(orderId: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    const shipment = await loadFurgonetkaShipment(orderId)
    if (shipment.trackingNumber) throw new Error('Ta przesyłka jest już zamówiona.')
    try {
      await orderAndSyncWaybill(shipment.id, shipment.furgonetkaId)
    } finally {
      refresh(orderId)
    }
    return null
  }, 'Nie udało się zamówić przesyłki.')
}

/**
 * Status z Furgonetki na żądanie (zapas, gdy webhook nie dotarł albo nie jest
 * jeszcze ustawiony). Te same reguły co webhook.
 */
export async function adminRefreshShipment(orderId: string): Promise<ActionResult<string>> {
  return runAdminAction(async () => {
    const shipment = await loadFurgonetkaShipment(orderId)
    const [info, latest] = await Promise.all([
      getShipment(shipment.furgonetkaId).catch(() => null),
      getLatestTracking(shipment.furgonetkaId),
    ])
    const next = latest ? TRACKING_STATE_MAP[latest.state] ?? null : null
    const changed = await applyShipmentState(shipment, next, info?.waybills[0])
    refresh(orderId)
    if (!latest) return 'Furgonetka nie ma jeszcze zdarzeń śledzenia.'
    return changed ? `Status zaktualizowany: ${latest.description || latest.state}` : `Bez zmian: ${latest.description || latest.state}`
  }, 'Nie udało się pobrać statusu z Furgonetki.')
}
