import { NextRequest, NextResponse, after } from 'next/server'
import {
  parseItn,
  buildItnConfirmation,
  isAutopayConfigured,
  type AutopayItnTransaction,
} from '@/lib/autopay'
import { db } from '@/lib/db'
import { orders, paymentTransactions } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { isPaymentSettled } from '@/lib/orderStatus'
import { deductStockQuietly } from '@/lib/inventory.server'

export const dynamic = 'force-dynamic'
export const runtime  = 'nodejs'

const XML_HEADERS = { 'Content-Type': 'text/xml; charset=utf-8' }

/**
 * ITN (Instant Transaction Notification) z Autopay.
 *
 * Format wejścia: POST application/x-www-form-urlencoded, pole `transactions`
 * zawierające XML zakodowany base64. Jeden komunikat może nieść wiele transakcji.
 *
 * Sklep nie korzysta z płatności automatycznych (zapisane karty / One Click —
 * usługa niedostępna na umowie), więc komunikatów `recurring` nie obsługujemy.
 *
 * Odpowiedź musi być XML-em <confirmationList> z poprawnym hashem — inaczej
 * Autopay ponawia komunikat w nieskończoność.
 */
export async function POST(req: NextRequest) {
  if (!isAutopayConfigured()) {
    console.error('[Autopay ITN] Brak konfiguracji AUTOPAY_SERVICE_ID / AUTOPAY_HASH_KEY')
    return new NextResponse('Autopay not configured', { status: 503 })
  }

  let encoded: string | null = null

  try {
    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const value = form.get('transactions')
      encoded = typeof value === 'string' ? value : null
    } else {
      // Zapasowo: niektóre konfiguracje wysyłają samo base64 w body.
      const body = (await req.text()).trim()
      encoded = body.startsWith('transactions=')
        ? decodeURIComponent(body.slice('transactions='.length).replace(/\+/g, ' '))
        : body || null
    }
  } catch (err) {
    console.error('[Autopay ITN] Nie udało się odczytać treści żądania', err)
    return new NextResponse('Bad request', { status: 400 })
  }

  if (!encoded) {
    console.warn('[Autopay ITN] Brak pola "transactions"')
    return new NextResponse('Missing "transactions"', { status: 400 })
  }

  let itn
  try {
    itn = parseItn(encoded)
  } catch (err) {
    console.warn('[Autopay ITN] Odrzucony komunikat:', (err as Error).message)
    return new NextResponse('Invalid ITN', { status: 400 })
  }

  const confirmations: Array<{ orderId: string; confirmed: boolean }> = []

  for (const transaction of itn.transactions) {
    let confirmed = false
    try {
      confirmed = await applyTransaction(transaction)
    } catch (err) {
      console.error('[Autopay ITN] Błąd przetwarzania transakcji', transaction.orderId, err)
      confirmed = false
    }
    confirmations.push({ orderId: transaction.orderId, confirmed })
  }

  return new NextResponse(buildItnConfirmation(confirmations), { headers: XML_HEADERS })
}

/**
 * Zapisuje skutek jednej transakcji. Zwraca `true`, gdy komunikat został
 * przyjęty (CONFIRMED) — czyli gdy nie ma powodu, by Autopay go ponawiał.
 */
async function applyTransaction(transaction: AutopayItnTransaction): Promise<boolean> {
  const { orderId, remoteId, paymentStatus } = transaction

  const [order] = await db
    .select({
      id:         orders.id,
      totalCents: orders.totalCents,
      status:     orders.status,
    })
    .from(orders)
    .where(eq(orders.id, orderId))

  if (!order) {
    console.error('[Autopay ITN] Nie znaleziono zamówienia', { orderId, remoteId })
    return false
  }

  // Idempotencja — zamówienie już rozliczone (także wysłane, doręczone albo
  // zwrócone), potwierdzamy bez zmian. Powtórzony ITN nie może cofnąć statusu.
  if (isPaymentSettled(order.status)) {
    return true
  }

  if (paymentStatus === 'PENDING') {
    await db
      .update(paymentTransactions)
      .set({ externalId: remoteId, rawResponse: JSON.stringify(transaction.raw) })
      .where(and(eq(paymentTransactions.orderId, orderId), eq(paymentTransactions.status, 'pending')))
    return true
  }

  if (paymentStatus === 'FAILURE') {
    await db
      .update(paymentTransactions)
      .set({ status: 'failed', externalId: remoteId, rawResponse: JSON.stringify(transaction.raw) })
      .where(and(eq(paymentTransactions.orderId, orderId), eq(paymentTransactions.status, 'pending')))
    return true
  }

  // Wpłata za zamówienie anulowane po terminie płatności (np. bank zaksięgował
  // ją z opóźnieniem — bramka ma ValidityTime, więc to rzadkie). Klient
  // zapłacił, więc zamówienie wraca jako opłacone; kod rabatowy, zwolniony przy
  // anulowaniu, nie jest naliczany ponownie — sprawdź zamówienie w panelu.
  if (order.status === 'cancelled' && paymentStatus === 'SUCCESS') {
    console.warn('[Autopay ITN] Wpłata za anulowane zamówienie — przywracam jako opłacone', { orderId })
  }

  // SUCCESS — weryfikacja kwoty i waluty przed oznaczeniem jako opłacone.
  const amountCents = Math.round(Number.parseFloat(transaction.amount) * 100)

  if (!Number.isFinite(amountCents) || order.totalCents !== amountCents) {
    console.error('[Autopay ITN] Niezgodna kwota', {
      orderId,
      expected: order.totalCents,
      received: amountCents,
    })
    await db
      .update(paymentTransactions)
      .set({ status: 'failed', externalId: remoteId, rawResponse: JSON.stringify(transaction.raw) })
      .where(and(eq(paymentTransactions.orderId, orderId), eq(paymentTransactions.status, 'pending')))
    return false
  }

  if (transaction.currency && transaction.currency.toUpperCase() !== 'PLN') {
    console.error('[Autopay ITN] Niezgodna waluta', { orderId, currency: transaction.currency })
    return false
  }

  await db.transaction(async tx => {
    await tx
      .update(paymentTransactions)
      .set({
        status:      'success',
        externalId:  remoteId,
        rawResponse: JSON.stringify(transaction.raw),
      })
      .where(and(eq(paymentTransactions.orderId, orderId), eq(paymentTransactions.status, 'pending')))

    await tx
      .update(orders)
      .set({ status: 'paid' })
      .where(eq(orders.id, orderId))
  })

  // Zdjęcie stanu magazynu po odpowiedzi — błąd Sanity nie może zablokować
  // potwierdzenia ITN (inaczej Autopay ponawiałby komunikat). Gdyby się nie
  // udało, dogrywa je zadanie cykliczne (`reconcileOrderStock`).
  after(() => deductStockQuietly(orderId, 'paid'))

  return true
}
