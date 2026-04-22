import { NextRequest, NextResponse } from 'next/server'
import { verifyIPN, verifyTransaction, type P24IPN } from '@/lib/przelewy24'
import { db } from '@/lib/db'
import { orders, paymentTransactions } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  let payload: P24IPN

  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!verifyIPN(payload)) {
    console.warn('[P24] Invalid IPN signature', { sessionId: payload.sessionId })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const { sessionId, orderId: p24OrderId, amount } = payload

  const [order] = await db
    .select({ id: orders.id, totalCents: orders.totalCents, status: orders.status })
    .from(orders)
    .where(eq(orders.id, sessionId))

  if (!order) {
    console.error('[P24] Order not found', { sessionId })
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // idempotency — already confirmed
  if (order.status === 'paid' || order.status === 'processing') {
    return NextResponse.json({ status: 'OK' })
  }

  if (order.totalCents !== amount) {
    console.error('[P24] Amount mismatch', { expected: order.totalCents, received: amount })
    await db
      .update(paymentTransactions)
      .set({ status: 'failed', rawResponse: JSON.stringify(payload) })
      .where(
        and(
          eq(paymentTransactions.orderId, sessionId),
          eq(paymentTransactions.status, 'pending'),
        ),
      )
    return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 })
  }

  try {
    await verifyTransaction({ sessionId, orderId: p24OrderId, amount, currency: 'PLN' })
  } catch (err) {
    console.error('[P24] Verify call failed', err)
    await db
      .update(paymentTransactions)
      .set({ status: 'failed', rawResponse: JSON.stringify(payload) })
      .where(
        and(
          eq(paymentTransactions.orderId, sessionId),
          eq(paymentTransactions.status, 'pending'),
        ),
      )
    return NextResponse.json({ error: 'Verification failed' }, { status: 502 })
  }

  await db.transaction(async tx => {
    await tx
      .update(paymentTransactions)
      .set({
        status:      'success',
        externalId:  String(p24OrderId),
        rawResponse: JSON.stringify(payload),
      })
      .where(
        and(
          eq(paymentTransactions.orderId, sessionId),
          eq(paymentTransactions.status, 'pending'),
        ),
      )

    await tx
      .update(orders)
      .set({ status: 'paid' })
      .where(eq(orders.id, sessionId))
  })

  return NextResponse.json({ status: 'OK' })
}
