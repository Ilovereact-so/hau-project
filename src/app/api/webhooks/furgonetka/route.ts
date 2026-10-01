import { NextRequest, NextResponse } from 'next/server'
import { eq, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { shipments, orders } from '@/db/schema'
import {
  TRACKING_STATE_MAP,
  detectFormat,
  parseNotification,
  shouldApplyStatus,
  verifyNotification,
  webhookReply,
  type WebhookFormat,
} from '@/lib/furgonetkaWebhook'

/*
 * Webhook statusów przesyłek Furgonetki (format i suma kontrolna — patrz
 * lib/furgonetkaWebhook.ts). „Sól” wpisana w panelu Furgonetki = zmienna
 * FURGONETKA_WEBHOOK_SECRET.
 *
 * Furgonetka uznaje dostarczenie TYLKO przy HTTP 200 + {"status":"OK"}
 * (albo <status>OK</status> dla XML), więc nieznana przesyłka (np. testowe
 * powiadomienie przy zapisie adresu w panelu) też dostaje OK — inaczej test
 * adresu by nie przeszedł, a prawdziwe powiadomienia byłyby ponawiane.
 */

export const dynamic = 'force-dynamic'

function reply(format: WebhookFormat, ok: boolean, status = 200) {
  const { body, contentType } = webhookReply(format, ok)
  return new NextResponse(body, { status, headers: { 'Content-Type': contentType } })
}

const ORDER_SHIPPED_FROM = ['paid', 'processing']
const ORDER_DELIVERED_FROM = ['paid', 'processing', 'shipped']

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const format = detectFormat(rawBody, req.headers.get('content-type'))
  const notification = parseNotification(rawBody, format)
  if (!notification) return reply(format, false, 400)

  const salt = process.env.FURGONETKA_WEBHOOK_SECRET ?? ''
  if (!salt) {
    console.error('[furgonetka] webhook: brak FURGONETKA_WEBHOOK_SECRET — powiadomienie odrzucone')
    return reply(format, false)
  }
  if (!verifyNotification(notification, salt)) {
    console.warn('[furgonetka] webhook: zła suma kontrolna', { packageId: notification.packageId })
    return reply(format, false)
  }

  const next = TRACKING_STATE_MAP[notification.state]
  if (!next || !notification.packageId) return reply(format, true)

  try {
    const [shipment] = await db
      .select({ id: shipments.id, orderId: shipments.orderId, status: shipments.status })
      .from(shipments)
      .where(
        notification.packageNo
          ? or(eq(shipments.furgonetkaId, notification.packageId), eq(shipments.trackingNumber, notification.packageNo))
          : eq(shipments.furgonetkaId, notification.packageId),
      )

    if (!shipment) {
      console.info('[furgonetka] webhook: nieznana przesyłka', { packageId: notification.packageId })
      return reply(format, true)
    }

    await db.transaction(async (tx) => {
      const patch: { status?: typeof next; trackingNumber?: string } = {}
      if (shouldApplyStatus(shipment.status, next)) patch.status = next
      if (notification.packageNo) patch.trackingNumber = notification.packageNo.slice(0, 128)
      if (Object.keys(patch).length) {
        await tx.update(shipments).set(patch).where(eq(shipments.id, shipment.id))
      }
      if (!patch.status) return

      const [order] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, shipment.orderId))
      if (!order) return
      if (next === 'delivered' && ORDER_DELIVERED_FROM.includes(order.status)) {
        await tx.update(orders).set({ status: 'delivered' }).where(eq(orders.id, shipment.orderId))
      } else if (
        (next === 'picked_up' || next === 'in_transit' || next === 'out_for_delivery') &&
        ORDER_SHIPPED_FROM.includes(order.status)
      ) {
        await tx.update(orders).set({ status: 'shipped' }).where(eq(orders.id, shipment.orderId))
      }
    })
  } catch (err) {
    // Błąd bazy → ERROR: Furgonetka zapisze nieudane dostarczenie i można je ponowić.
    console.error('[furgonetka] webhook: zapis statusu nie powiódł się', err)
    return reply(format, false, 500)
  }

  return reply(format, true)
}
