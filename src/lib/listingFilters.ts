import { effectivePrice } from '@/lib/omnibus'
import type { ProductPromotion } from '@/lib/promotion'

/*
 * Filtrowanie listingów (subkategoria, kategoria, wyszukiwarka) — jedno
 * miejsce zamiast kopii w każdej stronie. Czysta logika, bez importów
 * serwerowych.
 *
 * Adres:
 *  - `cena_od` / `cena_do` — przedział ceny (zł, całe złote). Oba opcjonalne:
 *    „od 100 zł” bez górnej granicy też jest poprawnym filtrem.
 *    Stary parametr `price` (sama górna granica) jest nadal rozumiany.
 *  - `<klucz filtra>=<slug wartości>` (np. `size=maly&size=sredni`) —
 *    filtry z Sanity (`filter.key` / `filterValue.slug`).
 *  - `q`, `sort` — zarezerwowane (fraza, sortowanie), nie są filtrami.
 *
 * Cena do filtrowania = cena, którą klient zapłaci (wariant → produkt,
 * z aktywną promocją) — tak jak na kafelku.
 */

export const PRICE_MIN_PARAM = 'cena_od'
export const PRICE_MAX_PARAM = 'cena_do'
/** Dawny parametr (sama górna granica) — czytany dla starych linków. */
export const LEGACY_PRICE_PARAM = 'price'

const RESERVED = new Set(['q', 'sort', PRICE_MIN_PARAM, PRICE_MAX_PARAM, LEGACY_PRICE_PARAM])

export type ListingParams = {
  /** Filtry opcji: klucz filtra → slugi wartości. */
  options: Record<string, string[]>
  priceMin: number | null
  priceMax: number | null
}

type FilterRef = { _ref?: string | null } | null | undefined

export type FilterableProduct = {
  _id: string
  price?: number | null
  promotion?: ProductPromotion | null
  filterValues?: Array<{ filter?: FilterRef; slug?: { current?: string | null } | null } | null> | null
  variants?: Array<{
    _key?: string | null
    price?: number | null
    optionValues?: Array<{
      name?: { key?: string | null } | null
      value?: { slug?: { current?: string | null } | null } | null
    } | null> | null
  } | null> | null
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

function parsePrice(value: string | string[] | undefined): number | null {
  const raw = first(value)?.trim().replace(',', '.')
  if (!raw) return null
  const number = Number(raw)
  if (!Number.isFinite(number) || number < 0 || number > 1_000_000) return null
  return Math.round(number * 100) / 100
}

export function parseListingParams(searchParams: Record<string, string | string[] | undefined>): ListingParams {
  const options: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(searchParams)) {
    if (RESERVED.has(key) || value === undefined) continue
    const values = (Array.isArray(value) ? value : [value]).filter((v) => typeof v === 'string' && v.trim())
    if (values.length) options[key] = values
  }
  let priceMin = parsePrice(searchParams[PRICE_MIN_PARAM])
  let priceMax = parsePrice(searchParams[PRICE_MAX_PARAM]) ?? parsePrice(searchParams[LEGACY_PRICE_PARAM])
  // Odwrócony przedział (od 100 do 50) — zamieniamy zamiast zwracać pustą listę.
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) [priceMin, priceMax] = [priceMax, priceMin]
  return { options, priceMin, priceMax }
}

export function hasListingFilters(params: ListingParams): boolean {
  return params.priceMin !== null || params.priceMax !== null || Object.keys(params.options).length > 0
}

const inRange = (price: number | null, min: number | null, max: number | null) => {
  if (min === null && max === null) return true
  if (price === null) return false
  return (min === null || price >= min) && (max === null || price <= max)
}

/**
 * Zostawia produkty spełniające WSZYSTKIE filtry (opcje + cena).
 *
 * Dwa rodzaje danych o produkcie:
 *  - PARAMETRY — `filterValues` produktu (kolumny `filter_*` z CSV): kolor,
 *    rozmiar psa itd., wspólne dla sklepu, niewidoczne na karcie produktu;
 *  - WARIANTY — tylko te parametry, które produkt ma w `productOptions`
 *    (to z nich klient wybiera na karcie).
 *
 * Filtr po kluczu, który jest opcją wariantów TEGO produktu, sprawdzamy na
 * wariantach (musi istnieć jeden wariant spełniający wszystkie takie filtry
 * i cenę — `defaultVariant` = pierwszy taki, kafelek pokaże jego zdjęcie
 * i cenę). Każdy inny klucz sprawdzamy na parametrach produktu — dzięki temu
 * np. szelki w 3 kolorach (warianty), ale tylko w rozmiarze „duży”
 * (parametr), znajdują się po filtrze „Rozmiar: duży”. Wcześniej produkty
 * z wariantami były sprawdzane wyłącznie na wariantach i w takim przypadku
 * znikały z listy.
 *
 * `filterIdsByKey` — mapa klucz filtra → `_id` dokumentu `filter`
 * (z `availableFilters`), potrzebna do dopasowania parametrów produktu.
 */
export function filterListingProducts<T extends FilterableProduct>(
  products: T[],
  params: ListingParams,
  filterIdsByKey: Map<string, string> = new Map(),
  now: Date = new Date(),
): (T & { defaultVariant?: string })[] {
  if (!hasListingFilters(params)) return products
  const optionEntries = Object.entries(params.options)
  const result: (T & { defaultVariant?: string })[] = []

  const matchesParameter = (product: T, key: string, slugs: string[]) => {
    const filterId = filterIdsByKey.get(key)
    return Boolean(
      filterId &&
        product.filterValues?.some((fv) => fv?.filter?._ref === filterId && fv.slug?.current && slugs.includes(fv.slug.current)),
    )
  }

  for (const product of products) {
    const variants = (product.variants ?? []).filter((variant) => variant?._key)
    if (!variants.length) {
      if (!inRange(effectivePrice(product, null, now), params.priceMin, params.priceMax)) continue
      if (optionEntries.every(([key, slugs]) => matchesParameter(product, key, slugs))) result.push(product)
      continue
    }

    const variantKeys = variantOptionKeys(variants)
    const onVariants = optionEntries.filter(([key]) => variantKeys.has(key))
    const onParameters = optionEntries.filter(([key]) => !variantKeys.has(key))
    if (!onParameters.every(([key, slugs]) => matchesParameter(product, key, slugs))) continue

    const match = variants.find((variant) => {
      if (!inRange(effectivePrice(product, variant!._key, now), params.priceMin, params.priceMax)) return false
      return onVariants.every(([key, slugs]) =>
        variant!.optionValues?.some(
          (ov) => ov?.name?.key === key && ov.value?.slug?.current && slugs.includes(ov.value.slug.current),
        ),
      )
    })
    if (match) result.push({ ...product, defaultVariant: match._key! })
  }
  return result
}

/** Klucze filtrów, z których produkt ma warianty (opcje wyboru na karcie produktu). */
export function variantOptionKeys(variants: FilterableProduct['variants']): Set<string> {
  const keys = new Set<string>()
  for (const variant of variants ?? []) {
    for (const option of variant?.optionValues ?? []) {
      if (option?.name?.key) keys.add(option.name.key)
    }
  }
  return keys
}

/** Zakres cen listy (całe złote) — granice pól „od/do” w filtrze ceny. */
export function listingPriceBounds(products: FilterableProduct[], now: Date = new Date()): { min: number; max: number } | null {
  let min = Number.POSITIVE_INFINITY
  let max = 0
  for (const product of products) {
    const keys = (product.variants ?? []).map((variant) => variant?._key).filter((key): key is string => Boolean(key))
    for (const key of keys.length ? keys : [null]) {
      const price = effectivePrice(product, key, now)
      if (price === null) continue
      if (price < min) min = price
      if (price > max) max = price
    }
  }
  if (!Number.isFinite(min)) return null
  return { min: Math.floor(min), max: Math.ceil(max) }
}
