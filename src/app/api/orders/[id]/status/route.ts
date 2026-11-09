import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { orders, paymentTransactions } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { verifyOrderAccessToken } from '@/lib/orderAccess'
import { isPaidOrderStatus } from '@/lib/orderStatus'

export const dynamic = 'force-dynamic'
export const runtime  = 'nodejs'

/**
 * Status zamówienia dla checkoutu — checkout odpytuje ten endpoint, czekając aż
 * ITN z Autopay potwierdzi płatność (formularz karty w ramce nie przekierowuje
 * przeglądarki, więc nie ma innego sygnału).
 *
 * Dostęp: właściciel zamówienia — zalogowany user albo gość po cookie `guest_id`
 * (w `orders.userId` trzymamy jedno albo drugie) — albo podpisany link
 * zamówienia gościa `?t=` (płatność z maila na innym urządzeniu).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const { userId } = await auth()
  const cookieStore = await cookies()
  const ownerId = userId ?? cookieStore.get('guest_id')?.value
  const token = req.nextUrl.searchParams.get('t')
  const tokenAccess = verifyOrderAccessToken(id, token)

  if (!ownerId && !tokenAccess) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [order] = await db
    .select({ id: orders.id, status: orders.status, userId: orders.userId })
    .from(orders)
    .where(eq(orders.id, id))

  if (!order || (order.userId !== ownerId && !tokenAccess)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [transaction] = await db
    .select({ status: paymentTransactions.status })
    .from(paymentTransactions)
    .where(eq(paymentTransactions.orderId, id))
    .orderBy(desc(paymentTransactions.createdAt))
    .limit(1)

  const settled = isPaidOrderStatus(order.status)

  return NextResponse.json({
    orderId:       order.id,
    status:        order.status,
    paymentStatus: transaction?.status ?? null,
    settled,
    failed:        transaction?.status === 'failed',
  })
}
