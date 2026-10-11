import 'server-only'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { orders, paymentTransactions } from '@/db/schema'
import { releaseDiscountForOrder } from '@/lib/discountServer'
import {
  AWAITING_PAYMENT_STATUS,
  DEFAULT_PAYMENT_DEADLINE_HOURS,
  isPaymentOverdue,
  paymentDeadline,
} from '@/lib/paymentDeadline'

/*
 * Nieopłacone zamówienia — termin, przypomnienia, anulowanie.
 *
 *  - Zamówienie z płatnością online powstaje jako `awaiting_payment` i czeka
 *    `PAYMENT_DEADLINE_HOURS` (domyślnie 72 h). W tym czasie klient może
 *    zapłacić ponownie (`payExistingOrder`) — strona zamówienia, mail, lista
 *    zamówień, pusty koszyk.
 *  - Przypomnienia mailem (cron co godzinę): po 1 h od złożenia oraz „ostatnie
 *    przypomnienie” 12 h przed terminem. Wysłane przypomnienia pamięta Redis —
 *    bez migracji bazy; gdy Redis nie działa, przypomnień nie wysyłamy
 *    (lepiej żadnego niż kilka tych samych).
 *  - Po terminie zamówienie przechodzi w `cancelled`, kod rabatowy wraca do puli,
 *    otwarte próby płatności wygasają. Robi to cron, a dodatkowo każda próba
 *    zapłaty i wejście na stronę zamówienia (anulowanie „leniwe”), więc termin
 *    obowiązuje nawet wtedy, gdy cron chwilowo nie działa.
 *  - Bramka nie przyjmie płatności po terminie: transakcja dostaje `ValidityTime`
 *    równe terminowi zamówienia.
 */

function readDeadlineHours(): number {
  const raw = Number.parseInt(process.env.ORDER_PAYMENT_DEADLINE_HOURS ?? '', 10)
  if (!Number.isFinite(raw)) return DEFAULT_PAYMENT_DEADLINE_HOURS
  return Math.min(Math.max(raw, 2), 24 * 30)
}

export const PAYMENT_DEADLINE_HOURS = readDeadlineHours()
/** Pierwsze przypomnienie — po tylu godzinach od złożenia. */
export const REMINDER_AFTER_HOURS = 1
/** Ostatnie przypomnienie — tyle godzin przed terminem (tylko przy terminie > 24 h). */
export const LAST_CALL_BEFORE_HOURS = 12

export function orderPaymentDeadline(createdAt: Date | string | null): Date {
  return paymentDeadline(createdAt ?? new Date(), PAYMENT_DEADLINE_HOURS)
}

/**
 * Anuluje zamówienie, które WCIĄŻ czeka na płatność (warunek w UPDATE — nie
 * anulujemy zamówienia, które w międzyczasie opłacił ITN). Zwraca `true`, gdy
 * to wywołanie faktycznie je anulowało.
 */
export async function cancelUnpaidOrder(orderId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const result = await tx
      .update(orders)
      .set({ status: 'cancelled' })
      .where(and(eq(orders.id, orderId), eq(orders.status, AWAITING_PAYMENT_STATUS)))
    const header = Array.isArray(result) ? result[0] : result
    const affected = (header as { affectedRows?: number })?.affectedRows ?? 0
    if (!affected) return false

    await releaseDiscountForOrder(tx, orderId)
    await tx
      .update(paymentTransactions)
      .set({ status: 'expired' })
      .where(and(eq(paymentTransactions.orderId, orderId), eq(paymentTransactions.status, 'pending')))
    return true
  })
}

/**
 * Anulowanie „leniwe”: zamówienie po terminie anulujemy przy pierwszym
 * kontakcie (strona zamówienia, próba zapłaty). Zwraca aktualny status.
 */
export async function expireIfOverdue(order: { id: string; status: string; createdAt: Date | string | null }, now = new Date()): Promise<string> {
  if (order.status !== AWAITING_PAYMENT_STATUS) return order.status
  if (!isPaymentOverdue(orderPaymentDeadline(order.createdAt), now)) return order.status
  const cancelled = await cancelUnpaidOrder(order.id)
  if (cancelled) console.info('[unpaid-orders] Anulowano po terminie (przy odczycie)', { orderId: order.id })
  // Gdy nie anulowaliśmy, ktoś nas wyprzedził (cron / ITN) — czytamy stan z bazy.
  if (cancelled) return 'cancelled'
  const [fresh] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, order.id)).limit(1)
  return fresh?.status ?? order.status
}

// ─── cron: przypomnienia i anulowanie ─────────────────────────────────────────

export type UnpaidOrderMailKind = 'reminder' | 'last-call' | 'cancelled'

export interface UnpaidOrdersReport {
  checked:   number
  cancelled: string[]
  reminded:  string[]
  lastCall:  string[]
  failed:    Array<{ orderId: string; error: string }>
}

const reminderKey = (orderId: string, kind: 'reminder' | 'last-call') => `orders:payment-reminder:v1:${kind}:${orderId}`

/** Rezerwuje wysyłkę maila (SET NX) — każdy rodzaj przypomnienia idzie najwyżej raz. */
async function claimReminder(orderId: string, kind: 'reminder' | 'last-call'): Promise<boolean> {
  try {
    const ttlSeconds = (PAYMENT_DEADLINE_HOURS + 24 * 7) * 3600
    const result = await redis.set(reminderKey(orderId, kind), String(Date.now()), { NX: true, EX: ttlSeconds })
    return result === 'OK'
  } catch (err) {
    console.warn('[unpaid-orders] Redis niedostępny — pomijam przypomnienie', { orderId, kind, err })
    return false
  }
}

/** Zwolnienie rezerwacji, gdy mail nie wyszedł (kolejny przebieg spróbuje ponownie). */
async function releaseReminder(orderId: string, kind: 'reminder' | 'last-call') {
  try { await redis.del(reminderKey(orderId, kind)) } catch { /* trudno — najwyżej bez przypomnienia */ }
}

export async function processUnpaidOrders(
  sendMail: (orderId: string, kind: UnpaidOrderMailKind) => Promise<boolean>,
  now: Date = new Date(),
): Promise<UnpaidOrdersReport> {
  const report: UnpaidOrdersReport = { checked: 0, cancelled: [], reminded: [], lastCall: [], failed: [] }

  const pending = await db
    .select({ id: orders.id, createdAt: orders.createdAt, paymentMethod: orders.paymentMethod })
    .from(orders)
    .where(and(eq(orders.status, AWAITING_PAYMENT_STATUS), inArray(orders.paymentMethod, ['autopay', 'przelewy24'])))
    .orderBy(asc(orders.createdAt))
    .limit(2000)

  for (const order of pending) {
    report.checked++
    try {
      const deadline = orderPaymentDeadline(order.createdAt)

      if (isPaymentOverdue(deadline, now)) {
        if (await cancelUnpaidOrder(order.id)) {
          report.cancelled.push(order.id)
          await sendMail(order.id, 'cancelled').catch((err) => console.error('[unpaid-orders] mail anulowania', { orderId: order.id, err }))
        }
        continue
      }

      const ageHours = (now.getTime() - new Date(order.createdAt ?? now).getTime()) / 3_600_000
      const hoursLeft = (deadline.getTime() - now.getTime()) / 3_600_000

      // Ostatnie przypomnienie ma pierwszeństwo — przy krótkim terminie nie
      // wysyłamy dwóch maili jeden po drugim.
      if (PAYMENT_DEADLINE_HOURS > 24 && hoursLeft <= LAST_CALL_BEFORE_HOURS) {
        if (await claimReminder(order.id, 'last-call')) {
          // Pierwsze przypomnienie przestaje mieć sens — oznaczamy je jako zużyte.
          await claimReminder(order.id, 'reminder')
          if (await sendMail(order.id, 'last-call')) report.lastCall.push(order.id)
          else await releaseReminder(order.id, 'last-call')
        }
        continue
      }

      if (ageHours >= REMINDER_AFTER_HOURS && (await claimReminder(order.id, 'reminder'))) {
        if (await sendMail(order.id, 'reminder')) report.reminded.push(order.id)
        else await releaseReminder(order.id, 'reminder')
      }
    } catch (err) {
      report.failed.push({ orderId: order.id, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return report
}
