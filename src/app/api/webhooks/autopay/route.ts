import { NextRequest, NextResponse } from 'next/server'
import { verifyITN, buildITNConfirmation, type AutopayITN } from '@/lib/autopay'
import { db } from '@/lib/db'
import { orders, paymentTransactions } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  let payload: AutopayITN

  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!verifyITN(payload)) {
    console.warn('[Autopay] Invalid ITN signature', { orderId: payload.OrderID })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const { OrderID: orderId, RemoteID: remoteId, Amount: amount, PaymentStatus: paymentStatus } = payload

  const [order] = await db
    .select({ id: orders.id, totalCents: orders.totalCents, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))

  if (!order) {
    console.error('[Autopay] Order not found', { orderId })
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // idempotency
  if (order.status === 'paid' || order.status === 'processing') {
    return new NextResponse(buildITNConfirmation(orderId), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const amountCents = Math.round(parseFloat(amount) * 100)

  if (paymentStatus === 'SUCCESS') {
    if (order.totalCents !== amountCents) {
      console.error('[Autopay] Amount mismatch', { expected: order.totalCents, received: amountCents })
      await db
        .update(paymentTransactions)
        .set({ status: 'failed', rawResponse: JSON.stringify(payload) })
        .where(
          and(
            eq(paymentTransactions.orderId, orderId),
            eq(paymentTransactions.status, 'pending'),
          ),
        )
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 })
    }

    await db.transaction(async tx => {
      await tx
        .update(paymentTransactions)
        .set({
          status:      'success',
          externalId:  remoteId,
          rawResponse: JSON.stringify(payload),
        })
        .where(
          and(
            eq(paymentTransactions.orderId, orderId),
            eq(paymentTransactions.status, 'pending'),
          ),
        )

      await tx
        .update(orders)
        .set({ status: 'paid' })
        .where(eq(orders.id, orderId))
    })
  } else if (paymentStatus === 'FAILURE') {
    await db
      .update(paymentTransactions)
      .set({ status: 'failed', externalId: remoteId, rawResponse: JSON.stringify(payload) })
      .where(
        and(
          eq(paymentTransactions.orderId, orderId),
          eq(paymentTransactions.status, 'pending'),
        ),
      )
  }

  // Autopay requires this confirmation response
  return new NextResponse(buildITNConfirmation(orderId), {
    headers: { 'Content-Type': 'application/json' },
  })
}
