import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getWebhookSalt } from '@/lib/furgonetka'
import { applyShipmentState, findShipmentByFurgonetka } from '@/lib/shipmentStatus'
import {
  TRACKING_STATE_MAP,
  detectFormat,
  parseNotification,
  verifyNotification,
  webhookReply,
  type FurgonetkaNotification,
  type WebhookFormat,
} from '@/lib/furgonetkaWebhook'

/*
 * Webhook statusów przesyłek Furgonetki (format i suma kontrolna — patrz
 * lib/furgonetkaWebhook.ts). Sól: FURGONETKA_WEBHOOK_SECRET albo — gdy jej
 * nie ma — ustawienia webhooka pobrane z API Furgonetki.
 *
 * Furgonetka uznaje dostarczenie TYLKO przy HTTP 200 + {"status":"OK"}
 * (albo <status>OK</status> dla XML). Powiadomienie o przesyłce, której
 * sklep nie zna, dostaje OK bez weryfikacji — niczego nie zmienia, a tak
 * wygląda test adresu przy zapisie webhooka w panelu Furgonetki (wtedy API
 * nie zna jeszcze nowej soli). Sumę kontrolną sprawdzamy, zanim cokolwiek
 * zapiszemy.
 */

export const dynamic = 'force-dynamic'

function reply(format: WebhookFormat, ok: boolean, status = 200) {
  const { body, contentType } = webhookReply(format, ok)
  return new NextResponse(body, { status, headers: { 'Content-Type': contentType } })
}

async function verify(notification: FurgonetkaNotification): Promise<boolean> {
  try {
    const salt = await getWebhookSalt()
    if (salt && verifyNotification(notification, salt)) return true
    // Sól mogła się właśnie zmienić w panelu — jeszcze raz, bez cache.
    if (process.env.FURGONETKA_WEBHOOK_SECRET) return false
    const fresh = await getWebhookSalt({ fresh: true })
    return Boolean(fresh) && fresh !== salt && verifyNotification(notification, fresh)
  } catch (err) {
    console.error('[furgonetka] webhook: nie udało się pobrać soli z API', err)
    return false
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const format = detectFormat(rawBody, req.headers.get('content-type'))
  const notification = parseNotification(rawBody, format)
  if (!notification) return reply(format, false, 400)

  try {
    const shipment = await findShipmentByFurgonetka(notification.packageId, notification.packageNo)
    if (!shipment) return reply(format, true)

    if (!(await verify(notification))) {
      console.warn('[furgonetka] webhook: zła suma kontrolna', { packageId: notification.packageId })
      return reply(format, false)
    }

    // Numer listu zapisujemy tylko dla przesyłki zamówionej (opłaconej w koszyku
    // Furgonetki) — jego obecność odblokowuje w panelu etykietę.
    const ordered = !['waiting', 'canceled', 'cancelled'].includes(notification.state)
    const changed = await applyShipmentState(
      shipment,
      TRACKING_STATE_MAP[notification.state] ?? null,
      ordered ? notification.packageNo : undefined,
    )
    if (changed) revalidatePath('/admin', 'layout')
  } catch (err) {
    // Błąd bazy → ERROR: Furgonetka zapisze nieudane dostarczenie i można je ponowić.
    console.error('[furgonetka] webhook: zapis statusu nie powiódł się', err)
    return reply(format, false, 500)
  }

  return reply(format, true)
}
