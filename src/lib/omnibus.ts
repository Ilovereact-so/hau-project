/*
 * Najniższa cena z 30 dni (dyrektywa Omnibus, art. 4 ust. 2–3 ustawy
 * o informowaniu o cenach towarów i usług).
 *
 * Czysta logika — bez importów serwerowych, używana i w przeglądarce
 * (kafelki), i na serwerze (strona produktu, API, rejestr cen).
 *
 * Model danych: historia ceny to ciąg przedziałów `[from, to)` — jeden
 * przedział = jedna cena obowiązująca w sklepie. Otwarty przedział
 * (`to = null`) to cena bieżąca. Historię prowadzi osobno każdy „klucz
 * ceny”: wariant (`variants[]._key`) albo sam produkt (klucz pusty).
 *
 * Zasady wyliczania:
 *  - OBNIŻKA jest wtedy, gdy bieżąca cena jest niższa od najniższej ceny
 *    z 30 dni PRZED wprowadzeniem bieżącej ceny. Ta najniższa cena jest
 *    wtedy ceną odniesienia: od niej liczymy procent obniżki i to ją
 *    pokazujemy jako przekreśloną. Wartość jest „zamrożona” na czas
 *    trwania obniżki — okno nie przesuwa się razem z kalendarzem.
 *  - Obniżki stopniowe (100 → 90 → 80) liczymy ostrożnie: każda cena
 *    względem 30 dni przed JEJ wprowadzeniem (dla 80 odniesieniem jest 90).
 *    Nigdy nie zawyża to procentu obniżki.
 *  - BEZ OBNIŻKI pokazujemy informacyjnie najniższą cenę z ostatnich
 *    30 dni (okno kroczące, łącznie z ceną bieżącą).
 *  - Procent obniżki zaokrągla się w dół (19,6% → 19%).
 *  - Produkt bez historii sprzed bieżącej ceny (nowy w sklepie) nie ma
 *    obniżki, a najniższa cena to cena bieżąca.
 */

export const OMNIBUS_WINDOW_DAYS = 30
export const OMNIBUS_WINDOW_MS = OMNIBUS_WINDOW_DAYS * 24 * 60 * 60 * 1000
/** Maks. liczba produktów w jednym żądaniu `/api/prices/omnibus`. */
export const OMNIBUS_BATCH_MAX = 60
/** Klucz ceny samego produktu (produkt bez wariantów / cena bazowa). */
export const BASE_PRICE_KEY = ''

export type PriceInterval = {
  /** Cena w groszach. */
  priceCents: number
  from: Date
  /** `null` — cena obowiązuje nadal. */
  to: Date | null
}

export type OmnibusPromo = {
  /** Najniższa cena z 30 dni przed wprowadzeniem obniżki (zł). */
  referencePrice: number
  /** Procent obniżki względem ceny odniesienia (liczba całkowita ≥ 1). */
  percent: number
  /** Od kiedy obowiązuje obniżona cena (ISO). */
  since: string
}

export type OmnibusInfo = {
  /** Cena, dla której policzono informację (zł). */
  price: number
  /** Najniższa cena z ostatnich 30 dni, łącznie z bieżącą (zł). */
  lowest30d: number
  /** Obniżka — `null`, gdy cena nie jest obniżona. */
  promo: OmnibusPromo | null
}

/** Informacje dla wszystkich kluczy cen jednego produktu. */
export type ProductOmnibus = Record<string, OmnibusInfo>

export const toCents = (price: number) => Math.round(price * 100)
export const fromCents = (cents: number) => Math.round(cents) / 100

export function isValidPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 10_000_000
}

/** `_id` produktu z Sanity (bez szkiców) — to samo ograniczenie co w opiniach. */
export function isValidProductId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,127}$/.test(id) && !id.startsWith('drafts.')
}

export function isValidPriceKey(key: unknown): key is string {
  return typeof key === 'string' && (key === BASE_PRICE_KEY || /^[A-Za-z0-9._-]{1,64}$/.test(key))
}

type PricedProduct = {
  price?: number | null
  variants?: Array<{ _key?: string | null; price?: number | null } | null> | null
}

/**
 * Cena, którą klient faktycznie zapłaci za wariant — tak samo liczą ją
 * koszyk i checkout: cena wariantu, a gdy jej brak — cena produktu.
 */
export function effectivePrice(product: PricedProduct | null | undefined, variantKey?: string | null): number | null {
  if (!product) return null
  if (variantKey) {
    const variant = product.variants?.find((v) => v?._key === variantKey)
    if (variant && isValidPrice(variant.price)) return variant.price
  }
  return isValidPrice(product.price) ? product.price : null
}

/**
 * Wszystkie ceny sprzedażowe produktu, które rejestrujemy:
 * cena bazowa (klucz pusty) + efektywna cena każdego wariantu.
 */
export function priceKeysOf(product: PricedProduct): Map<string, number> {
  const result = new Map<string, number>()
  if (isValidPrice(product.price)) result.set(BASE_PRICE_KEY, toCents(product.price))
  for (const variant of product.variants ?? []) {
    const key = variant?._key
    if (!key || !isValidPriceKey(key) || key === BASE_PRICE_KEY) continue
    const price = effectivePrice(product, key)
    if (price !== null) result.set(key, toCents(price))
  }
  return result
}

/** Klucz ceny pokazywanej na kafelku — kafelek linkuje i dodaje do koszyka pierwszy wariant. */
export function tilePriceKey(product: { variants?: Array<{ _key?: string | null } | null> | null }): string {
  return product.variants?.[0]?._key || BASE_PRICE_KEY
}

const overlaps = (interval: PriceInterval, start: number, end: number) =>
  interval.from.getTime() < end && (interval.to === null || interval.to.getTime() > start)

function minCents(intervals: PriceInterval[], start: number, end: number): number | null {
  let min: number | null = null
  for (const interval of intervals) {
    if (!overlaps(interval, start, end)) continue
    if (min === null || interval.priceCents < min) min = interval.priceCents
  }
  return min
}

/**
 * Wylicza informację Omnibus dla jednego klucza ceny.
 *
 * `displayedPrice` — cena, którą widzi klient. Zwykle równa bieżącej cenie
 * z historii; różni się tylko przez chwilę po zmianie (cache katalogu).
 * Wtedy nie pokazujemy obniżki, a najniższą cenę liczymy z uwzględnieniem
 * ceny wyświetlanej — lepiej przez minutę nie pokazać promocji, niż
 * pokazać ją błędnie.
 */
export function computeOmnibus(
  intervals: PriceInterval[],
  displayedPrice: number,
  now: Date = new Date(),
): OmnibusInfo {
  const displayedCents = toCents(displayedPrice)
  const nowMs = now.getTime()
  const sorted = intervals
    .filter((i) => i.from.getTime() <= nowMs && Number.isFinite(i.priceCents) && i.priceCents > 0)
    .sort((a, b) => a.from.getTime() - b.from.getTime())

  // Bieżący przedział: otwarty, a w razie niespójności — najpóźniejszy trwający.
  const current =
    [...sorted].reverse().find((i) => i.to === null) ??
    [...sorted].reverse().find((i) => i.to !== null && i.to.getTime() > nowMs) ??
    null

  const rolling = minCents(sorted, nowMs - OMNIBUS_WINDOW_MS, nowMs + 1)
  const lowestCents = Math.min(displayedCents, rolling ?? displayedCents)

  let promo: OmnibusPromo | null = null
  if (current && current.priceCents === displayedCents) {
    const start = current.from.getTime()
    const before = minCents(
      sorted.filter((i) => i !== current),
      start - OMNIBUS_WINDOW_MS,
      start,
    )
    if (before !== null && before > displayedCents) {
      // W dół — procent obniżki nigdy nie może być zawyżony.
      const percent = Math.floor((1 - displayedCents / before) * 100 + 1e-9)
      if (percent >= 1) {
        promo = { referencePrice: fromCents(before), percent, since: current.from.toISOString() }
      }
    }
  }

  return { price: fromCents(displayedCents), lowest30d: fromCents(lowestCents), promo }
}

/** Informacja, gdy historia jest niedostępna (np. awaria bazy): bez obniżki, najniższa = bieżąca. */
export function fallbackOmnibus(price: number): OmnibusInfo {
  return { price, lowest30d: price, promo: null }
}

/** Walidacja kształtu przychodzącego z API (przeglądarka). */
export function isOmnibusInfo(value: unknown): value is OmnibusInfo {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (!isValidPrice(v.price) || !isValidPrice(v.lowest30d)) return false
  if (v.promo === null) return true
  if (!v.promo || typeof v.promo !== 'object') return false
  const p = v.promo as Record<string, unknown>
  return isValidPrice(p.referencePrice) && typeof p.percent === 'number' && typeof p.since === 'string'
}

export type ResolvedPrice = {
  /** Cena wyświetlana (z katalogu). */
  price: number
  /** `null` — dane jeszcze się ładują. */
  info: OmnibusInfo | null
}

/**
 * Łączy cenę z katalogu z danymi z rejestru. Gdy rejestr ma inną bieżącą
 * cenę (świeża zmiana, cache), nie pokazujemy obniżki, a najniższą cenę
 * liczymy ostrożnie z obu wartości.
 */
export function resolveOmnibus(
  data: ProductOmnibus | null | undefined,
  priceKey: string,
  price: number,
): OmnibusInfo | null {
  if (data === undefined) return null
  const info = data?.[priceKey]
  if (!info) return fallbackOmnibus(price)
  if (toCents(info.price) === toCents(price)) return info
  return { price, lowest30d: Math.min(price, info.lowest30d), promo: null }
}
