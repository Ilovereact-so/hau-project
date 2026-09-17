/*
 * Formatowanie liczb i dat w panelu.
 *
 * UWAGA NA JEDNOSTKI: w bazie HAU kwoty są w GROSZACH (`*_cents`), a ceny
 * produktów w Sanity — w ZŁOTYCH. Funkcje z sufiksem `Cents` przyjmują grosze.
 */

const money = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  maximumFractionDigits: 0,
})

const moneyPrecise = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
})

/** Złote → „1 234 zł” (bez groszy — kafelki KPI, wykresy). */
export function formatCurrency(value: number) {
  return money.format(Number.isFinite(value) ? value : 0)
}

/** Złote → „1 234,50 zł”. */
export function formatCurrencyPrecise(value: number) {
  return moneyPrecise.format(Number.isFinite(value) ? value : 0)
}

/** Grosze → „1 234 zł”. */
export function formatCents(cents: number | null | undefined) {
  return formatCurrency(Number(cents ?? 0) / 100)
}

/** Grosze → „1 234,50 zł”. */
export function formatCentsPrecise(cents: number | null | undefined) {
  return formatCurrencyPrecise(Number(cents ?? 0) / 100)
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** „12.09.2026” */
export function formatDate(value: Date | string | null | undefined) {
  const date = toDate(value)
  return date
    ? date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'
}

/** „12 wrz 2026, 14:05” */
export function formatDateTime(value: Date | string | null | undefined) {
  const date = toDate(value)
  return date
    ? new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : '—'
}

export function formatDay(value?: string) {
  return value ? new Date(value).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) : ''
}

/** Skrócony, czytelny numer zamówienia — `orders.id` to UUID. */
export function orderNumber(id: string) {
  return `#${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

/** Procentowa zmiana okres do okresu; `null`, gdy porównanie nie ma sensu. */
export function changePct(current: number, previous: number): number | null {
  if (!previous) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}
