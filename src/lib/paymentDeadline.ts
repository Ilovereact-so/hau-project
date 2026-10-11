/*
 * Termin płatności nieopłaconego zamówienia — czysta logika, wspólna dla
 * przeglądarki i serwera (bez importów serwerowych).
 *
 * Model jak w dużych sklepach (Allegro, empik, Zalando): złożone zamówienie
 * czeka na płatność określony czas. Klient może w tym czasie zapłacić
 * ponownie dowolną metodą (strona zamówienia, przycisk w mailu), dostaje
 * przypomnienia, a po terminie zamówienie anuluje się samo (zwalniając kod
 * rabatowy). Długość terminu ustawia serwer (`ORDER_PAYMENT_DEADLINE_HOURS`).
 */

export const DEFAULT_PAYMENT_DEADLINE_HOURS = 72

/** Statusy, w których zamówienie czeka na płatność online. */
export const AWAITING_PAYMENT_STATUS = 'awaiting_payment'

export function paymentDeadline(createdAt: Date | string, hours: number): Date {
  const created = new Date(createdAt)
  return new Date(created.getTime() + hours * 60 * 60 * 1000)
}

export function isPaymentOverdue(deadline: Date | string, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(deadline).getTime()
}

const deadlineFormatter = new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * „14 października, 17:52” (czas polski niezależnie od strefy przeglądarki).
 * Składane z części, bo silniki różnie łączą datę z godziną („… o 17:52”,
 * „… 17:52”) — serwer i przeglądarka muszą dać ten sam tekst.
 */
export function formatPaymentDeadline(deadline: Date | string): string {
  const parts = Object.fromEntries(
    deadlineFormatter.formatToParts(new Date(deadline)).map((part) => [part.type, part.value]),
  )
  return `${parts.day} ${parts.month}, ${parts.hour}:${parts.minute}`
}

/** Ile zostało: „2 dni”, „5 godz.”, „40 min” — do komunikatów. */
export function timeLeftLabel(deadline: Date | string, now: Date = new Date()): string {
  const ms = new Date(deadline).getTime() - now.getTime()
  if (ms <= 0) return '0 min'
  const minutes = Math.ceil(ms / 60000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} godz.`
  const days = Math.floor(hours / 24)
  return `${days} dni`
}
