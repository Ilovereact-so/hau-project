import type { OrderStatus } from '@/db/schema'

/*
 * Wspólne grupy statusów zamówienia (czyste — bez importów serwerowych).
 *
 * Zamówienie wysłane albo doręczone też jest OPŁACONE. Wcześniej webhooki
 * płatności i ekrany statusu sprawdzały tylko `paid | processing`, więc
 * powtórzony ITN (operatorzy ponawiają komunikaty) cofał wysłane zamówienie
 * z powrotem na „opłacone”, a klient wracający z bramki po wysyłce widział
 * „płatność w toku”.
 */

/** Zamówienie opłacone (także w realizacji, wysłane, doręczone). */
export const PAID_ORDER_STATUSES = ['paid', 'processing', 'shipped', 'delivered'] as const

export function isPaidOrderStatus(status: OrderStatus | string | null | undefined): boolean {
  return (PAID_ORDER_STATUSES as readonly string[]).includes(status ?? '')
}

/**
 * Płatność za zamówienie jest już rozliczona — webhook operatora nie może
 * zmieniać jego statusu (opłacone w dowolnym etapie realizacji albo zwrócone).
 */
export function isPaymentSettled(status: OrderStatus | string | null | undefined): boolean {
  return isPaidOrderStatus(status) || status === 'refunded'
}
