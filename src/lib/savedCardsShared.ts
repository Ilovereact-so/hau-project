/*
 * Zapisane karty — wspólne dla kasy (przeglądarka), profilu i serwera.
 * Bez importów serwerowych.
 *
 * Sklep NIGDY nie widzi numeru karty: kartę przechowuje Autopay, a my mamy
 * token (`ClientHash`) i dane do wyświetlenia — wydawcę, 4 ostatnie cyfry
 * i datę ważności (z powiadomienia `recurringActivation`).
 */

/** Kanał „Płatność kartą One Click” w Autopay (zapis i płatność zapisaną kartą). */
export const ONECLICK_GATEWAY_ID = 1503

/**
 * Treść zgody na zapis karty — pokazywana przy checkboksie w kasie.
 * Brzmienie za oficjalną wtyczką Autopay (domyślna „Autopay Agreement”);
 * zaznaczenie = `RecurringAcceptanceState=ACCEPTED` w transakcji.
 */
export const SAVE_CARD_AGREEMENT =
  'Wyrażam zgodę na zapisanie danych karty płatniczej w formie zaszyfrowanej w systemach krajowej instytucji płatniczej nadzorowanej przez Komisję Nadzoru Finansowego Autopay S.A. w celu dokonywania płatności „jednym kliknięciem”, tj. bez konieczności każdorazowego wprowadzania danych karty płatniczej. Mogę usunąć zapisaną kartę w dowolnym momencie na swoim koncie.'

/** Karta do wyświetlenia — bez tokenu (token nie opuszcza serwera). */
export interface SavedCardView {
  id:           string
  maskedNumber: string | null
  expiryMonth:  number | null
  expiryYear:   number | null
  cardBrand:    string | null
  createdAt:    Date | string | null
}

export type CardBrandKey = 'visa' | 'mastercard' | 'maestro' | 'amex' | 'other'

export function cardBrandKey(brand: string | null | undefined): CardBrandKey {
  const value = (brand ?? '').toUpperCase()
  if (value.includes('VISA')) return 'visa'
  if (value.includes('MAESTRO')) return 'maestro'
  if (value.includes('MASTER')) return 'mastercard'
  if (value.includes('AMEX') || value.includes('AMERICAN')) return 'amex'
  return 'other'
}

export function cardBrandLabel(brand: string | null | undefined): string {
  switch (cardBrandKey(brand)) {
    case 'visa': return 'Visa'
    case 'mastercard': return 'Mastercard'
    case 'maestro': return 'Maestro'
    case 'amex': return 'American Express'
    default: return brand?.trim() || 'Karta płatnicza'
  }
}

/**
 * Ostatnie 4 cyfry z maski Autopay. Maska przychodzi różnie („1234”,
 * „************1234”, „4111 11** **** 1111”) — bierzemy ostatnie 4 cyfry.
 */
export function cardLast4(mask: string | null | undefined): string | null {
  const digits = (mask ?? '').replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(-4) : null
}

/** „•••• 1234” albo null, gdy maski brak. */
export function cardMaskLabel(mask: string | null | undefined): string | null {
  const last4 = cardLast4(mask)
  return last4 ? `•••• ${last4}` : null
}

export function cardExpiryLabel(month: number | null, year: number | null): string | null {
  if (!month || !year) return null
  return `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`
}

/** Karta ważna do końca miesiąca ważności. Brak daty = nie wiemy, traktujemy jako ważną. */
export function isCardExpired(month: number | null, year: number | null, now: Date = new Date()): boolean {
  if (!month || !year) return false
  const endOfValidity = new Date(year, month, 1) // pierwszy dzień NASTĘPNEGO miesiąca (lokalnie)
  return now >= endOfValidity
}

/** Ważna jeszcze najwyżej przez bieżący i kolejny miesiąc — w profilu pokazujemy ostrzeżenie. */
export function isCardExpiringSoon(month: number | null, year: number | null, now: Date = new Date()): boolean {
  if (!month || !year || isCardExpired(month, year, now)) return false
  const monthsLeft = (year - now.getFullYear()) * 12 + (month - (now.getMonth() + 1))
  return monthsLeft <= 1
}

/** Krótki opis karty, np. „Visa •••• 1234”. */
export function cardShortLabel(card: Pick<SavedCardView, 'cardBrand' | 'maskedNumber'>): string {
  const mask = cardMaskLabel(card.maskedNumber)
  return mask ? `${cardBrandLabel(card.cardBrand)} ${mask}` : cardBrandLabel(card.cardBrand)
}
