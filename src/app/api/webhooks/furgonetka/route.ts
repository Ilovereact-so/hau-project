import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { db } from '@/lib/db'
import { shipments, orders } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { ShipmentStatus } from '@/db/schema'

const WEBHOOK_SECRET = process.env.FURGONETKA_WEBHOOK_SECRET!

// Status mapping from Furgonetka events to our enum
const STATUS_MAP: Record<string, ShipmentStatus> = {
  'picked_up':        'picked_up',
  'in_transit':       'in_transit',
  'out_for_delivery': 'out_for_delivery',
  'delivered':        'delivered',
  'delivery_failed':  'failed',
  'returned':         'returned',
}

interface FurgonetkaWebhookPayload {
  event:          string
  package_id:     string
  tracking_number?: string
  status:         string
  timestamp:      string
}

function verifySignature(body: string, signature: string | null): boolean {
  if (!signature) return false
  const expected = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')
  return expected === signature
}

export async function POST(req: NextRequest) {
  const rawBody  = await req.text()
  const signature = req.headers.get('x-furgonetka-signature')

  if (!verifySignature(rawBody, signature)) {
    console.warn('[Furgonetka] Invalid webhook signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: FurgonetkaWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const nextStatus = STATUS_MAP[payload.status]
  if (!nextStatus) {
    // unknown status — acknowledge but ignore
    return NextResponse.json({ status: 'OK' })
  }

  const [shipment] = await db
    .select({ id: shipments.id, orderId: shipments.orderId })
    .from(shipments)
    .where(eq(shipments.furgonetkaId, payload.package_id))

  if (!shipment) {
    console.error('[Furgonetka] Shipment not found', { furgonetkaId: payload.package_id })
    return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
  }

  await db.transaction(async tx => {
    await tx
      .update(shipments)
      .set({
        status:         nextStatus,
        trackingNumber: payload.tracking_number ?? undefined,
      })
      .where(eq(shipments.id, shipment.id))

    if (nextStatus === 'delivered') {
      await tx
        .update(orders)
        .set({ status: 'delivered' })
        .where(eq(orders.id, shipment.orderId))
    } else if (nextStatus === 'in_transit' || nextStatus === 'out_for_delivery') {
      await tx
        .update(orders)
        .set({ status: 'shipped' })
        .where(eq(orders.id, shipment.orderId))
    }
  })

  return NextResponse.json({ status: 'OK' })
}
