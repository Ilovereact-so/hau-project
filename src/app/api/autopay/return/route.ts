import { NextRequest, NextResponse } from 'next/server'
import { verifyReturnHash, fromAutopayOrderId, isAutopayConfigured } from '@/lib/autopay'
import { db } from '@/lib/db'
import { orders, paymentTransactions } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const runtime  = 'nodejs'

/**
 * Powrót klienta ze strony Autopay.
 *
 * Ten adres wpisuje się w panelu Autopay jako „adres powrotu po płatności”.
 * Autopay przekierowuje tu przeglądarkę z parametrami ServiceID, OrderID i Hash
 * (Hash = ALGO(ServiceID|OrderID|klucz)).
 *
 * Powrót NIE jest źródłem prawdy o statusie płatności — status ustawia ITN.
 * Tutaj tylko sprawdzamy podpis i pokazujemy klientowi jego zamówienie.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  return handleReturn(req, {
    serviceId: params.get('ServiceID') ?? params.get('serviceID') ?? '',
    orderId:   params.get('OrderID')   ?? params.get('orderID')   ?? '',
    hash:      params.get('Hash')      ?? params.get('hash')      ?? '',
  })
}

export async function POST(req: NextRequest) {
  let serviceId = ''
  let orderId   = ''
  let hash      = ''

  try {
    const form = await req.formData()
    serviceId = String(form.get('ServiceID') ?? form.get('serviceID') ?? '')
    orderId   = String(form.get('OrderID')   ?? form.get('orderID')   ?? '')
    hash      = String(form.get('Hash')      ?? form.get('hash')      ?? '')
  } catch {
    // pusty formularz — obsłuży walidacja niżej
  }

  return handleReturn(req, { serviceId, orderId, hash })
}

function appUrl(req: NextRequest): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || req.nextUrl.origin).replace(/\/+$/, '')
}

async function handleReturn(
  req: NextRequest,
  { serviceId, orderId, hash }: { serviceId: string; orderId: string; hash: string },
) {
  const base = appUrl(req)

  if (!isAutopayConfigured()) {
    console.error('[Autopay return] Brak konfiguracji Autopay')
    return NextResponse.redirect(`${base}/cart?payment=error`)
  }

  if (!serviceId || !orderId || !hash) {
    console.warn('[Autopay return] Niekompletne parametry powrotu')
    return NextResponse.redirect(`${base}/cart?payment=error`)
  }

  if (!verifyReturnHash(serviceId, orderId, hash)) {
    console.warn('[Autopay return] Nieprawidłowy hash powrotu', { orderId })
    return NextResponse.redirect(`${base}/cart?payment=error`)
  }

  const internalOrderId = fromAutopayOrderId(orderId)

  const [order] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.id, internalOrderId))

  if (!order) {
    console.error('[Autopay return] Nie znaleziono zamówienia', { orderId, internalOrderId })
    return NextResponse.redirect(`${base}/cart?payment=error`)
  }

  // ITN potrafi dotrzeć po powrocie klienta — dlatego domyślnie "pending".
  // Gdy ITN zdążył już zgłosić odrzuconą płatność, mówimy to wprost: strona
  // zamówienia od razu pokaże wyróżnione „Zapłać ponownie”.
  const [latest] = await db
    .select({ status: paymentTransactions.status })
    .from(paymentTransactions)
    .where(eq(paymentTransactions.orderId, order.id))
    .orderBy(desc(paymentTransactions.createdAt))
    .limit(1)
  const payment =
    order.status === 'paid' || order.status === 'processing'
      ? 'success'
      : order.status === 'awaiting_payment' && latest?.status === 'failed'
        ? 'failed'
        : 'pending'

  // /orders/[id] kieruje zalogowanego do profilu, a gościa na /zamowienie/[id].
  return NextResponse.redirect(`${base}/orders/${order.id}?payment=${payment}`)
}
