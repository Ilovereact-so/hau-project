import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { orders, paymentTransactions, savedCards } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { isPaymentSettled } from '@/lib/orderStatus'
import { deductStockQuietly } from '@/lib/inventory.server'

// DEV-ONLY — blocked in production.
// Simulates a successful Autopay payment + card saving so the full order flow
// can be tested without real credentials.

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 })
  }

  const orderId = req.nextUrl.searchParams.get('orderId')
  if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })

  const [order] = await db
    .select({ id: orders.id, status: orders.status, userId: orders.userId })
    .from(orders)
    .where(eq(orders.id, orderId))

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  // Idempotent
  if (isPaymentSettled(order.status)) {
    return NextResponse.redirect(`${appUrl}/orders/${orderId}?payment=success`)
  }

  const [tx] = await db
    .select({ id: paymentTransactions.id, saveCardConsent: paymentTransactions.saveCardConsent })
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.orderId, orderId),
        eq(paymentTransactions.status, 'pending'),
      ),
    )

  const mockToken = `DEV_TOKEN_${crypto.randomUUID().slice(0, 8).toUpperCase()}`

  await db.transaction(async dbTx => {
    await dbTx
      .update(paymentTransactions)
      .set({
        status:      'success',
        externalId:  'DEV_BYPASS',
        cardToken:   tx?.saveCardConsent ? mockToken : null,
        rawResponse: JSON.stringify({ dev: true, simulatedAt: new Date().toISOString() }),
      })
      .where(
        and(
          eq(paymentTransactions.orderId, orderId),
          eq(paymentTransactions.status, 'pending'),
        ),
      )

    await dbTx
      .update(orders)
      .set({ status: 'paid' })
      .where(eq(orders.id, orderId))

    // Simulate card save when user gave consent
    if (tx?.saveCardConsent && order.userId) {
      await dbTx.insert(savedCards).values({
        id:           crypto.randomUUID(),
        userId:       order.userId,
        provider:     'autopay',
        token:        mockToken,
        maskedNumber: '****4242',
        expiryMonth:  12,
        expiryYear:   2027,
        cardBrand:    'Visa',
        isActive:     true,
      })
    }
  })

  await deductStockQuietly(orderId, 'paid')

  return NextResponse.redirect(`${appUrl}/orders/${orderId}?payment=success`)
}
