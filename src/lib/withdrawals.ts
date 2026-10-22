/*
 * Odstąpienie od umowy przez formularz online — część czysta (walidacja,
 * stałe), wspólna dla formularza w przeglądarce i akcji serwerowej.
 *
 * Podstawa: art. 11a dyrektywy 2011/83/UE w brzmieniu dyrektywy (UE)
 * 2023/2673 („funkcja odstąpienia od umowy”, stosowana od 19.06.2026):
 *  - funkcja oznaczona jednoznacznie („Odstąp od umowy”), łatwo dostępna
 *    przez cały okres na odstąpienie,
 *  - konsument podaje imię i nazwisko, dane umowy i adres e-mail do
 *    potwierdzenia, a oświadczenie składa dopiero przyciskiem
 *    potwierdzającym (drugi krok),
 *  - przedsiębiorca niezwłocznie potwierdza otrzymanie na trwałym nośniku
 *    (mail z treścią oświadczenia oraz datą i godziną złożenia).
 */

export const WITHDRAWAL_PATH = '/help/odstapienie-od-umowy'

export const WITHDRAWAL_LIMITS = {
  name: 200,
  email: 256,
  orderNumber: 64,
  items: 2000,
  note: 2000,
} as const

export type WithdrawalInput = {
  name: string
  email: string
  orderNumber: string
  /** Których produktów dotyczy — puste = całe zamówienie. */
  items: string
  note: string
}

export type WithdrawalErrors = Partial<Record<keyof WithdrawalInput, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function normalizeWithdrawal(raw: Partial<Record<keyof WithdrawalInput, unknown>>): WithdrawalInput {
  const text = (value: unknown, max: number) => (typeof value === 'string' ? value : '').trim().slice(0, max)
  return {
    name: text(raw.name, WITHDRAWAL_LIMITS.name),
    email: text(raw.email, WITHDRAWAL_LIMITS.email).toLowerCase(),
    // „#3f2a 9c1b” → „3F2A9C1B”; numer z maila to pierwsze 8 znaków id zamówienia.
    orderNumber: text(raw.orderNumber, WITHDRAWAL_LIMITS.orderNumber).replace(/^#/, '').replace(/\s+/g, '').toUpperCase(),
    items: text(raw.items, WITHDRAWAL_LIMITS.items),
    note: text(raw.note, WITHDRAWAL_LIMITS.note),
  }
}

export function validateWithdrawal(input: WithdrawalInput): WithdrawalErrors {
  const errors: WithdrawalErrors = {}
  if (input.name.length < 3) errors.name = 'Podaj imię i nazwisko.'
  if (!EMAIL_RE.test(input.email)) errors.email = 'Podaj poprawny adres e-mail — wyślemy na niego potwierdzenie.'
  if (input.orderNumber.length < 4) errors.orderNumber = 'Podaj numer zamówienia (znajdziesz go w mailu z potwierdzeniem, np. 3F2A9C1B).'
  return errors
}

/** Numer zamówienia pokazywany klientom (maile, profil): pierwsze 8 znaków id. */
export function orderNumberFromId(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase()
}
