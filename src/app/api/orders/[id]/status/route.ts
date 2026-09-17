import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { orders, paymentTransactions } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const runtime  = 'nodejs'

/**
 * Status zamówienia dla checkoutu — checkout odpytuje ten endpoint, czekając aż
 * ITN z Autopay potwierdzi płatność (BLIK-0 i formularz karty w ramce nie
 * przekierowują przeglądarki, więc nie ma innego sygnału).
 *
 * Dostęp: właściciel zamówienia — zalogowany user albo gość po cookie `guest_id`
 * (w `orders.userId` trzymamy jedno albo drugie).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const { userId } = await auth()
  const cookieStore = await cookies()
  const ownerId = userId ?? cookieStore.get('guest_id')?.value

  if (!ownerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [order] = await db
    .select({ id: orders.id, status: orders.status, userId: orders.userId })
    .from(orders)
    .where(eq(orders.id, id))

  if (!order || order.userId !== ownerId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [transaction] = await db
    .select({ status: paymentTransactions.status })
    .from(paymentTransactions)
    .where(eq(paymentTransactions.orderId, id))
    .orderBy(desc(paymentTransactions.createdAt))
    .limit(1)

  const settled = order.status === 'paid' || order.status === 'processing'

  return NextResponse.json({
    orderId:       order.id,
    status:        order.status,
    paymentStatus: transaction?.status ?? null,
    settled,
    failed:        transaction?.status === 'failed',
  })
}
