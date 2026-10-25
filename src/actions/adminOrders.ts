'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orders, shipments, shippingAddresses, SHIPMENT_STATUSES, type OrderStatus, type ShipmentStatus } from '@/db/schema'
import { createShipment, deleteShipment, type FurgonetkaAddress, type FurgonetkaParcel } from '@/lib/furgonetka'
import { syncFurgonetkaShipment } from '@/lib/shipmentStatus'
import { runAdminAction, type ActionResult } from '@/lib/admin/guard'
import { ORDER_TRANSITIONS } from '@/lib/admin/labels'
import { releaseDiscountForOrder } from '@/lib/discountServer'
import { RECONCILABLE_STATUSES, deductStockForOrder, restoreStockForOrder } from '@/lib/inventory.server'

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

/**
 * Zmiana statusu. Wynik `data` = ostrzeżenie do pokazania (np. status zmieniony,
 * ale stanu magazynu nie udało się oddać) albo `null`.
 */
export async function adminUpdateOrderStatus(orderId: string, status: OrderStatus): Promise<ActionResult<string | null>> {
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
    // Anulowanie oddaje zdjęty stan na magazyn. Zwrot („refunded”) — NIE:
    // towar wraca dopiero, gdy paczka dojedzie (przycisk w karcie „Magazyn”).
    let warning: string | null = null
    if (status === 'cancelled') {
      const result = await restoreStockForOrder(orderId, 'cancelled')
      if (!result.ok) warning = `Zamówienie anulowane, ale stan magazynu nie wrócił: ${result.error}`
    }
    refresh(orderId)
    return warning
  }, 'Nie udało się zmienić statusu.')
}

/** „Towar wrócił na magazyn” — dla zamówień zwróconych (i anulowanych, gdyby oddanie się nie udało). */
export async function adminRestockOrder(orderId: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    const order = await loadOrder(orderId)
    if (order.status !== 'refunded' && order.status !== 'cancelled') {
      throw new Error('Stan wraca na magazyn tylko przy zamówieniu zwróconym albo anulowanym.')
    }
    const result = await restoreStockForOrder(orderId, order.status === 'refunded' ? 'returned' : 'cancelled')
    if (!result.ok) throw new Error(result.error)
    refresh(orderId)
    return null
  }, 'Nie udało się oddać stanu na magazyn.')
}

/** Ponowienie zdjęcia stanu (np. po awarii Sanity) dla zamówienia opłaconego. */
export async function adminDeductOrderStock(orderId: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    const order = await loadOrder(orderId)
    if (!RECONCILABLE_STATUSES.includes(order.status)) {
      throw new Error('Stan zdejmuje się tylko dla zamówień opłaconych (albo za pobraniem).')
    }
    const result = await deductStockForOrder(orderId, 'reconcile')
    if (!result.ok) throw new Error(result.error)
    refresh(orderId)
    return null
  }, 'Nie udało się zdjąć stanu.')
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
        status: 'created',
        parcelWeightG: Math.round(parcel.weightKg * 1000),
      })
      if (order.status === 'paid') {
        await tx.update(orders).set({ status: 'processing' }).where(eq(orders.id, order.id))
      }
    })

    // Przesyłka ląduje w KOSZYKU Furgonetki — zamawia i opłaca się ją tam.
    // Numer listu i etykieta pojawią się po opłaceniu (webhook / „Odśwież status”).
    refresh(order.id)
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

/**
 * Stan z Furgonetki na żądanie: czy przesyłka została opłacona w koszyku
 * (→ numer listu, etykieta) i jaki ma status śledzenia. Zapas, gdy webhook
 * nie dotarł; te same reguły co webhook.
 */
export async function adminRefreshShipment(orderId: string): Promise<ActionResult<string>> {
  return runAdminAction(async () => {
    const shipment = await loadFurgonetkaShipment(orderId)
    const result = await syncFurgonetkaShipment(shipment)
    refresh(orderId)
    if (result.kind === 'waiting') return 'Przesyłka czeka w koszyku Furgonetki — opłać ją tam, a etykieta pojawi się tutaj.'
    if (result.kind === 'cancelled') return 'Przesyłka została anulowana w Furgonetce — usuń ją tutaj i utwórz nową.'
    if (!result.latest) return 'Przesyłka opłacona — etykieta gotowa. Kurier jeszcze jej nie odebrał.'
    const what = result.latest.description || result.latest.state
    return result.changed ? `Status zaktualizowany: ${what}` : `Bez zmian: ${what}`
  }, 'Nie udało się pobrać statusu z Furgonetki.')
}

/**
 * Usunięcie przesyłki, która nie została opłacona (np. błędne wymiary albo
 * anulowana w Furgonetce) — można wtedy utworzyć ją od nowa.
 */
export async function adminDiscardShipment(orderId: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    const shipment = await loadFurgonetkaShipment(orderId)
    if (shipment.trackingNumber) {
      throw new Error('Przesyłka jest już opłacona — anuluj ją w panelu Furgonetki.')
    }
    try {
      await deleteShipment(shipment.furgonetkaId)
    } catch (err) {
      // Już usunięta / anulowana w Furgonetce — u nas i tak sprzątamy.
      console.warn('[furgonetka] usuwanie przesyłki', err)
    }
    await db.delete(shipments).where(eq(shipments.id, shipment.id))
    refresh(orderId)
    return null
  }, 'Nie udało się usunąć przesyłki.')
}
