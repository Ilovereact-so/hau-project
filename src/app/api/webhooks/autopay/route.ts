import { NextRequest, NextResponse, after } from 'next/server'
import {
  parseItn,
  buildItnConfirmation,
  parseRecurringNotification,
  buildRecurringConfirmation,
  isAutopayConfigured,
  type AutopayItnTransaction,
  type AutopayRecurringNotification,
} from '@/lib/autopay'
import { db } from '@/lib/db'
import { orders, paymentTransactions } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { deactivateCardByToken, isGuestOwner, upsertSavedCard } from '@/lib/savedCards.server'
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
 * Na ten sam adres przychodzą też komunikaty o ZAPISANYCH KARTACH — pole
 * `recurring` (base64 XML `<recurringActivation>` / `<recurringDeactivation>`).
 * Dopiero z nich dostajemy token karty i jej dane do wyświetlenia.
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
  let recurringEncoded: string | null = null

  try {
    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const value = form.get('transactions')
      encoded = typeof value === 'string' ? value : null
      const recurring = form.get('recurring')
      recurringEncoded = typeof recurring === 'string' ? recurring : null
    } else {
      // Zapasowo: niektóre konfiguracje wysyłają samo base64 w body.
      const body = (await req.text()).trim()
      if (body.startsWith('recurring=')) {
        recurringEncoded = decodeURIComponent(body.slice('recurring='.length).replace(/\+/g, ' '))
      } else {
        encoded = body.startsWith('transactions=')
          ? decodeURIComponent(body.slice('transactions='.length).replace(/\+/g, ' '))
          : body || null
      }
    }
  } catch (err) {
    console.error('[Autopay ITN] Nie udało się odczytać treści żądania', err)
    return new NextResponse('Bad request', { status: 400 })
  }

  // Base64 w formularzu bywa z zamienionym „+” na spację (tak robią wtyczki Autopay).
  if (recurringEncoded) return handleRecurring(recurringEncoded.replace(/ /g, '+'))

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
      userId:     orders.userId,
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

  const [txRecord] = await db
    .select({ id: paymentTransactions.id, saveCardConsent: paymentTransactions.saveCardConsent })
    .from(paymentTransactions)
    .where(and(eq(paymentTransactions.orderId, orderId), eq(paymentTransactions.status, 'pending')))

  await db.transaction(async tx => {
    await tx
      .update(paymentTransactions)
      .set({
        status:      'success',
        externalId:  remoteId,
        cardToken:   transaction.recurringToken,
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

  // Część konfiguracji Autopay dokleja dane karty także do ITN transakcji.
  // Główną drogą zapisu jest jednak komunikat `recurringActivation` (niżej).
  if (txRecord?.saveCardConsent && transaction.recurringToken && !isGuestOwner(order.userId)) {
    const [month, year] = (transaction.cardExpiry ?? '').split('/')
    const expiryMonth = month ? Number.parseInt(month, 10) : Number.NaN
    const expiryYearRaw = year ? Number.parseInt(year, 10) : Number.NaN
    const expiryYear = Number.isFinite(expiryYearRaw) && expiryYearRaw < 100 ? 2000 + expiryYearRaw : expiryYearRaw
    try {
      await upsertSavedCard({
        userId:      order.userId as string,
        token:       transaction.recurringToken,
        mask:        transaction.cardMask,
        brand:       transaction.cardIssuer,
        expiryMonth: Number.isFinite(expiryMonth) ? expiryMonth : null,
        expiryYear:  Number.isFinite(expiryYear) ? expiryYear : null,
      })
    } catch (err) {
      // Płatność jest rozliczona — błąd zapisu karty nie może jej cofnąć.
      console.error('[Autopay ITN] Nie udało się zapisać karty z ITN', { orderId, err })
    }
  }

  return true
}

// ─── zapisane karty ───────────────────────────────────────────────────────────

async function handleRecurring(encoded: string): Promise<NextResponse> {
  let notification: AutopayRecurringNotification
  try {
    notification = parseRecurringNotification(encoded)
  } catch (err) {
    console.warn('[Autopay recurring] Odrzucony komunikat:', (err as Error).message)
    return new NextResponse('Invalid recurring notification', { status: 400 })
  }

  let confirmed = false
  try {
    confirmed = notification.type === 'activation'
      ? await activateCard(notification)
      : await deactivateCard(notification)
  } catch (err) {
    console.error('[Autopay recurring] Błąd przetwarzania', { type: notification.type, err })
    confirmed = false
  }

  return new NextResponse(buildRecurringConfirmation(notification.clientHash, confirmed), { headers: XML_HEADERS })
}

/**
 * Karta zapisana w Autopay po udanej płatności. Przypisujemy ją do właściciela
 * zamówienia — tylko zalogowanego klienta, który zaznaczył zgodę na zapis.
 * Bez tego odpowiadamy NOTCONFIRMED (tak jak wtyczka Autopay do Magento).
 */
async function activateCard(notification: AutopayRecurringNotification): Promise<boolean> {
  if (!notification.orderId) {
    console.warn('[Autopay recurring] Aktywacja bez numeru zamówienia', { clientHash: notification.clientHash.slice(0, 8) })
    return false
  }

  const [order] = await db
    .select({ id: orders.id, userId: orders.userId })
    .from(orders)
    .where(eq(orders.id, notification.orderId))
    .limit(1)

  if (!order) {
    console.error('[Autopay recurring] Nie znaleziono zamówienia', { orderId: notification.orderId })
    return false
  }
  if (isGuestOwner(order.userId)) {
    console.warn('[Autopay recurring] Zamówienie gościa — karty nie zapisujemy', { orderId: order.id })
    return false
  }

  const [payment] = await db
    .select({ saveCardConsent: paymentTransactions.saveCardConsent })
    .from(paymentTransactions)
    .where(eq(paymentTransactions.orderId, order.id))
    .orderBy(desc(paymentTransactions.createdAt))
    .limit(1)

  if (!payment?.saveCardConsent) {
    console.warn('[Autopay recurring] Brak zgody na zapis karty w zamówieniu', { orderId: order.id })
    return false
  }

  await upsertSavedCard({
    userId:      order.userId,
    token:       notification.clientHash,
    mask:        notification.card.mask,
    brand:       notification.card.issuer,
    expiryMonth: notification.card.validityMonth,
    expiryYear:  notification.card.validityYear,
  })
  return true
}

/** Karta usunięta po stronie Autopay / banku — znika z konta klienta. */
async function deactivateCard(notification: AutopayRecurringNotification): Promise<boolean> {
  await deactivateCardByToken(notification.clientHash)
  return true
}
