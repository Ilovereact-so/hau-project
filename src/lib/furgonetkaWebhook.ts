import { createHash, timingSafeEqual } from 'crypto'
import type { ShipmentStatus } from '@/db/schema'

/*
 * Powiadomienia o statusie przesyłek z Furgonetki (webhook) — czysta logika.
 *
 * Konfiguracja w panelu Furgonetki (Ustawienia → Powiadomienia → Webhook):
 * adres, „sól” (token) i format JSON albo XML. Zapis wymaga udanego testu
 * adresu — Furgonetka wysyła wtedy przykładowe powiadomienie i oczekuje
 * HTTP 200 + `{"status":"OK"}` (JSON) albo `<status>OK</status>` (XML).
 * Gołe „OK” albo inny kod = test nieudany.
 *
 * Powiadomienie (JSON; XML ma te same pola pod `<Notification>`):
 *   {"package_id":21351614,"package_no":"…","partner_order_id":"12",
 *    "tracking":{"datetime":"2026-09-29 11:59:34","state":"delivered",
 *                "description":"…","branch":""},"control":"…"}
 * Suma kontrolna (to nie podpis HMAC):
 *   md5(package_id . package_no . partner_order_id . state . description . datetime . branch . sól)
 * — wartości tak, jak przyszły, bez separatorów, brakujące jako "".
 */

export type WebhookFormat = 'json' | 'xml'

export interface FurgonetkaNotification {
  packageId: string
  packageNo: string
  partnerOrderId: string
  state: string
  description: string
  datetime: string
  branch: string
  control: string
}

const text = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : ''

export function detectFormat(body: string, contentType: string | null): WebhookFormat {
  if ((contentType ?? '').toLowerCase().includes('xml')) return 'xml'
  return body.trimStart().startsWith('<') ? 'xml' : 'json'
}

function decodeXml(raw: string): string {
  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/)
  if (cdata) return cdata[1]
  return raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
}

function xmlField(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`))
  return match ? decodeXml(match[1]) : ''
}

/** `null`, gdy treść nie jest powiadomieniem Furgonetki. */
export function parseNotification(body: string, format: WebhookFormat): FurgonetkaNotification | null {
  if (format === 'xml') {
    // Bez DOCTYPE/encji — Furgonetka ich nie wysyła.
    if (/<!DOCTYPE|<!ENTITY/i.test(body) || !/<Notification[\s>]/.test(body)) return null
    const tracking = xmlField(body, 'tracking')
    return {
      packageId: xmlField(body, 'package_id'),
      packageNo: xmlField(body, 'package_no'),
      partnerOrderId: xmlField(body, 'partner_order_id'),
      state: xmlField(tracking, 'state'),
      description: xmlField(tracking, 'description'),
      datetime: xmlField(tracking, 'datetime'),
      branch: xmlField(tracking, 'branch'),
      control: xmlField(body, 'control'),
    }
  }
  let data: unknown
  try {
    data = JSON.parse(body)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const payload = data as Record<string, unknown>
  const tracking = (payload.tracking && typeof payload.tracking === 'object' ? payload.tracking : {}) as Record<string, unknown>
  return {
    packageId: text(payload.package_id),
    packageNo: text(payload.package_no),
    partnerOrderId: text(payload.partner_order_id),
    state: text(tracking.state),
    description: text(tracking.description),
    datetime: text(tracking.datetime),
    branch: text(tracking.branch),
    control: text(payload.control),
  }
}

export function notificationChecksum(n: FurgonetkaNotification, salt: string): string {
  return createHash('md5')
    .update(n.packageId + n.packageNo + n.partnerOrderId + n.state + n.description + n.datetime + n.branch + salt, 'utf8')
    .digest('hex')
}

export function verifyNotification(n: FurgonetkaNotification, salt: string): boolean {
  const control = n.control.trim().toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(control)) return false
  return timingSafeEqual(Buffer.from(notificationChecksum(n, salt)), Buffer.from(control))
}

/** Odpowiedź, której oczekuje Furgonetka — zawsze HTTP 200, w formacie powiadomienia. */
export function webhookReply(format: WebhookFormat, ok: boolean): { body: string; contentType: string } {
  const status = ok ? 'OK' : 'ERROR'
  return format === 'xml'
    ? { body: `<?xml version="1.0" encoding="UTF-8"?><status>${status}</status>`, contentType: 'text/xml; charset=utf-8' }
    : { body: JSON.stringify({ status }), contentType: 'application/json' }
}

/**
 * Stany śledzenia Furgonetki (z myślnikami) → status przesyłki w sklepie.
 * `waiting`/`ordered` niczego nie zmieniają; `canceled` też nie (anulowanie
 * przesyłki to decyzja w panelu, nie automatycznie zamówienia).
 */
export const TRACKING_STATE_MAP: Record<string, ShipmentStatus> = {
  collected: 'picked_up',
  'ready-for-transport': 'in_transit',
  transit: 'in_transit',
  delivery: 'out_for_delivery',
  'waiting-for-receiver': 'out_for_delivery',
  delivered: 'delivered',
  'delivery-problem': 'failed',
  'collect-problem': 'failed',
  returned: 'returned',
}

/** Kolejność statusów — powiadomienie spóźnione nie cofa przesyłki (np. „w drodze” po „doręczona”). */
const RANK: Record<ShipmentStatus, number> = {
  created: 0,
  picked_up: 1,
  in_transit: 2,
  out_for_delivery: 3,
  failed: 3,
  delivered: 4,
  returned: 4,
}

export function shouldApplyStatus(current: string, next: ShipmentStatus): boolean {
  const from = RANK[current as ShipmentStatus] ?? 0
  return RANK[next] >= from && current !== next
}
