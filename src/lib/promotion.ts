/*
 * Promocje produktów — OSOBNO od ceny regularnej.
 *
 * Czysta logika (bez importów serwerowych): używają jej kafelki i koszyk
 * w przeglądarce, kasa, rejestr cen i sortowanie na serwerze. Wszystkie
 * miejsca liczą cenę przez `effectivePrice` (lib/omnibus.ts), które woła
 * `applyPromotion` — dzięki temu klient płaci dokładnie to, co widzi.
 *
 * Zasady:
 *  - Zmiana pola `price` to ZWYKŁA zmiana ceny: sklep nie pokazuje
 *    przekreślenia ani informacji Omnibus.
 *  - Obniżkę ogłasza się WYŁĄCZNIE promocją (`product.promotion`). Tylko
 *    w czasie jej trwania sklep pokazuje przekreśloną cenę (najniższą
 *    z 30 dni przed promocją), procent i informację Omnibus.
 *  - Promocja może mieć początek i koniec (czasowa). Brak początku = od razu,
 *    brak końca = do wyłączenia.
 *  - Rodzaje: procent od ceny (każdy wariant osobno) albo cena promocyjna
 *    w zł — obowiązuje warianty droższe od niej; tańsze zostają bez zmian
 *    (promocja nie może podnieść ceny).
 */

export type PromotionType = 'percent' | 'price'

export type ProductPromotion = {
  enabled?: boolean | null
  discountType?: PromotionType | string | null
  value?: number | null
  /** ISO 8601 (UTC). */
  startsAt?: string | null
  /** ISO 8601 (UTC). */
  endsAt?: string | null
}

/** Maks. procent obniżki — chroni przed literówką „100” = darmowy produkt. */
export const PROMOTION_MAX_PERCENT = 90

export type PromotionState = 'none' | 'disabled' | 'scheduled' | 'active' | 'ended' | 'invalid'

function toTime(value: string | null | undefined): number | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
}

/** Czy promocja ma poprawną wartość (bez względu na daty). */
export function isPromotionValid(promotion: ProductPromotion | null | undefined): boolean {
  if (!promotion) return false
  const value = promotion.value
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return false
  if (promotion.discountType === 'percent') return value >= 1 && value <= PROMOTION_MAX_PERCENT
  if (promotion.discountType === 'price') return value < 10_000_000
  return false
}

/** Stan promocji w danej chwili — do etykiet w panelu i do decyzji w sklepie. */
export function promotionState(promotion: ProductPromotion | null | undefined, now: Date = new Date()): PromotionState {
  if (!promotion) return 'none'
  if (!promotion.enabled) return 'disabled'
  if (!isPromotionValid(promotion)) return 'invalid'
  const start = toTime(promotion.startsAt)
  const end = toTime(promotion.endsAt)
  if (start !== null && end !== null && end <= start) return 'invalid'
  const t = now.getTime()
  if (start !== null && t < start) return 'scheduled'
  if (end !== null && t >= end) return 'ended'
  return 'active'
}

export function isPromotionActive(promotion: ProductPromotion | null | undefined, now: Date = new Date()): boolean {
  return promotionState(promotion, now) === 'active'
}

/**
 * Cena po promocji (zł). Bez aktywnej promocji — cena regularna bez zmian.
 * Wynik zaokrąglony do grosza; procent liczony od groszy, żeby uniknąć
 * błędów zmiennoprzecinkowych (19,99 × 0,8 = 15,992 → 15,99).
 */
export function applyPromotion(
  regularPrice: number,
  promotion: ProductPromotion | null | undefined,
  now: Date = new Date(),
): number {
  if (!isPromotionActive(promotion, now)) return regularPrice
  const regularCents = Math.round(regularPrice * 100)
  let promoCents = regularCents
  if (promotion!.discountType === 'percent') {
    promoCents = Math.round((regularCents * (100 - promotion!.value!)) / 100)
  } else if (promotion!.discountType === 'price') {
    promoCents = Math.min(regularCents, Math.round(promotion!.value! * 100))
  }
  // Nigdy 0 zł i nigdy drożej niż cena regularna.
  if (promoCents <= 0 || promoCents >= regularCents) return regularPrice
  return promoCents / 100
}

/** Krótki opis promocji do panelu („-20%”, „59,99 zł”). */
export function describePromotion(promotion: ProductPromotion | null | undefined): string {
  if (!promotion || !isPromotionValid(promotion)) return ''
  if (promotion.discountType === 'percent') return `-${promotion.value}%`
  return `${promotion.value!.toFixed(2).replace('.', ',')} zł`
}

/**
 * Normalizacja danych z formularza panelu (walidacja po stronie serwera).
 * Zwraca obiekt gotowy do zapisu w Sanity albo rzuca czytelny błąd.
 */
export function normalizePromotionInput(input: ProductPromotion | null | undefined): ProductPromotion | null {
  if (!input) return null
  const discountType: PromotionType = input.discountType === 'price' ? 'price' : 'percent'
  const value = typeof input.value === 'number' && Number.isFinite(input.value) ? Math.round(input.value * 100) / 100 : null
  const startsAt = toTime(input.startsAt)
  const endsAt = toTime(input.endsAt)
  const enabled = Boolean(input.enabled)

  if (enabled) {
    if (value === null || value <= 0) throw new Error('Podaj wartość promocji.')
    if (discountType === 'percent' && (value < 1 || value > PROMOTION_MAX_PERCENT)) {
      throw new Error(`Procent promocji musi być w zakresie 1–${PROMOTION_MAX_PERCENT}.`)
    }
    if (startsAt !== null && endsAt !== null && endsAt <= startsAt) {
      throw new Error('Koniec promocji musi być późniejszy niż jej początek.')
    }
  }

  return {
    enabled,
    discountType,
    value,
    startsAt: startsAt !== null ? new Date(startsAt).toISOString() : null,
    endsAt: endsAt !== null ? new Date(endsAt).toISOString() : null,
  }
}
