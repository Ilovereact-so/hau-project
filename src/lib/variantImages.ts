/*
 * Zdjęcia wariantów — czysta logika (bez importów serwerowych), wspólna dla
 * strony produktu, koszyka, panelu, Studio i importu.
 *
 * Model: zdjęcia produktu to jedna lista `images[]`. Każde zdjęcie może mieć
 * `variantKeys` — `_key` wariantów, do których należy (jedno zdjęcie może
 * należeć do wielu wariantów). Puste/brak = zdjęcie WSPÓLNE, widoczne przy
 * każdym wariancie. Dzięki temu admin wgrywa wszystkie zdjęcia raz, a potem
 * tylko zaznacza przynależność.
 */

export type VariantImageLike = { _key?: string | null; variantKeys?: string[] | null }

export type VariantLike = {
  _key?: string | null
  optionValues?: Array<{
    name?: { key?: string | null } | null
    value?: { slug?: { current?: string | null } | null; value?: string | null } | null
  } | null> | null
}

function keysOf(image: VariantImageLike): string[] {
  return Array.isArray(image.variantKeys) ? image.variantKeys.filter((k) => typeof k === 'string' && k) : []
}

export function isSharedImage(image: VariantImageLike): boolean {
  return keysOf(image).length === 0
}

/**
 * Galeria dla wariantu: najpierw zdjęcia przypisane do wariantu (pierwsze
 * z nich staje się głównym), potem wspólne. Gdy wariant nie ma własnych
 * zdjęć — same wspólne; gdy nie ma ani własnych, ani wspólnych — wszystkie
 * (lepsze cudze zdjęcie niż pusta galeria).
 */
export function imagesForVariant<T extends VariantImageLike>(images: T[] | null | undefined, variantKey?: string | null): T[] {
  const list = (images ?? []).filter(Boolean)
  if (!list.length) return []
  const own = variantKey ? list.filter((image) => keysOf(image).includes(variantKey)) : []
  const shared = list.filter(isSharedImage)
  const result = [...own, ...shared]
  return result.length ? result : list
}

/** Pierwsze (główne) zdjęcie wariantu — miniatura w koszyku, na liście życzeń itd. */
export function primaryImageForVariant<T extends VariantImageLike>(images: T[] | null | undefined, variantKey?: string | null): T | undefined {
  return imagesForVariant(images, variantKey)[0]
}

/** Mapa opcji wariantu: `{ color: 'mint', size: 'm' }` (klucz filtra → slug wartości). */
export function variantOptionMap(variant: VariantLike | null | undefined): Record<string, string> {
  const map: Record<string, string> = {}
  for (const option of variant?.optionValues ?? []) {
    const key = option?.name?.key
    const value = option?.value?.slug?.current
    if (key && value) map[key] = value
  }
  return map
}

/**
 * Zdjęcie dla próbki wartości opcji (np. kolor „mint”) — pierwsze zdjęcie
 * wariantu, który ma tę wartość. Preferujemy wariant zgodny z pozostałymi
 * aktualnie wybranymi opcjami (ten sam rozmiar), a jeśli taki nie ma
 * własnych zdjęć — dowolny wariant z tą wartością.
 */
export function swatchImageFor<T extends VariantImageLike>(
  images: T[] | null | undefined,
  variants: VariantLike[] | null | undefined,
  optionKey: string,
  valueSlug: string,
  current: Record<string, string> = {},
): T | undefined {
  const list = (images ?? []).filter(Boolean)
  const candidates = (variants ?? []).filter((variant) => variantOptionMap(variant)[optionKey] === valueSlug)
  const score = (variant: VariantLike) => {
    const map = variantOptionMap(variant)
    return Object.entries(current).filter(([key, value]) => key !== optionKey && map[key] === value).length
  }
  const ordered = [...candidates].sort((a, b) => score(b) - score(a))
  for (const variant of ordered) {
    const key = variant._key
    if (!key) continue
    const own = list.find((image) => keysOf(image).includes(key))
    if (own) return own
  }
  return list.find(isSharedImage) ?? list[0]
}

/**
 * Zdjęcie przypisane wyłącznie do wariantów, których już nie ma — sklep go
 * nie pokazuje (nie jest wspólne), panel oznacza je jako ukryte.
 */
export function isOrphanImage(image: VariantImageLike, variantKeys: Iterable<string>): boolean {
  const keys = keysOf(image)
  if (!keys.length) return false
  const valid = new Set(variantKeys)
  return !keys.some((key) => valid.has(key))
}

/** Usuwa z przypisań klucze wariantów, których już nie ma (np. po zmianie opcji). */
export function pruneVariantKeys(keys: string[] | null | undefined, variantKeys: Iterable<string>): string[] {
  const valid = new Set(variantKeys)
  return [...new Set((keys ?? []).filter((key) => valid.has(key)))]
}

// ─── dopasowanie plików (import ZIP) ──────────────────────────────────────────

/** Normalizacja nazw do porównań: małe litery, bez polskich znaków, separatory → „-”. */
export function normalizeToken(input: string): string {
  return String(input ?? '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'l')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export type FileMatch = {
  /** kolejność z nazwy pliku (`slug-mint-2.jpg` → 2), 0 = bez numeru */
  order: number
  /** wartości opcji z nazwy pliku (np. ['mint']) — puste = zdjęcie wspólne */
  values: string[]
}

/**
 * Rozbiera nazwę pliku względem sluga/SKU produktu:
 *   pumpkin-plush.jpg          → wspólne, kolejność 0
 *   pumpkin-plush-2.jpg        → wspólne, kolejność 2
 *   pumpkin-plush-mint.jpg     → wartość „mint”
 *   pumpkin-plush-mint-m-3.jpg → wartości „mint” i „m”, kolejność 3
 * `knownValues` to slugi wartości opcji produktu — dzięki nim „mint-green”
 * rozpoznajemy jako jedną wartość, a nie dwie. Zwraca null, gdy plik nie
 * należy do produktu.
 */
export function matchFileToProduct(filename: string, prefixes: string[], knownValues: string[]): FileMatch | null {
  const base = normalizeToken(filename.split('/').pop()!.replace(/\.[^.]+$/, ''))
  if (!base) return null
  const normalizedPrefixes = [...new Set(prefixes.map(normalizeToken).filter(Boolean))].sort((a, b) => b.length - a.length)
  let rest: string | null = null
  for (const prefix of normalizedPrefixes) {
    if (base === prefix) {
      rest = ''
      break
    }
    if (base.startsWith(`${prefix}-`)) {
      rest = base.slice(prefix.length + 1)
      break
    }
    // „slug2.jpg” (stary format importu: numer bez separatora)
    const glued = base.match(new RegExp(`^${prefix.replace(/[-]/g, '\\-')}(\\d+)$`))
    if (glued) return { order: Number(glued[1]), values: [] }
  }
  if (rest === null) return null
  if (!rest) return { order: 0, values: [] }

  const values: string[] = []
  const known = [...new Set(knownValues.map(normalizeToken).filter(Boolean))].sort((a, b) => b.length - a.length)
  let remaining = rest
  let order = 0
  while (remaining) {
    const number = remaining.match(/^(\d+)(?:-|$)/)
    if (number) {
      order = Number(number[1])
      remaining = remaining.slice(number[0].length)
      continue
    }
    const value = known.find((v) => remaining === v || remaining.startsWith(`${v}-`))
    if (value) {
      values.push(value)
      remaining = remaining.slice(value.length).replace(/^-/, '')
      continue
    }
    // Nieznany fragment (np. „front”, „detal”) — ignorujemy go, nie odrzucamy pliku.
    remaining = remaining.replace(/^[^-]+-?/, '')
  }
  return { order, values }
}

/** Warianty pasujące do wszystkich wartości z nazwy pliku (np. „mint” → wszystkie rozmiary w kolorze mint). */
export function variantKeysForValues(variants: VariantLike[] | null | undefined, values: string[]): string[] {
  if (!values.length) return []
  const wanted = values.map(normalizeToken)
  return (variants ?? [])
    .filter((variant) => {
      const slugs = Object.values(variantOptionMap(variant)).map(normalizeToken)
      return wanted.every((value) => slugs.includes(value))
    })
    .map((variant) => variant._key)
    .filter((key): key is string => Boolean(key))
}
