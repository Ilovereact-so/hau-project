/*
 * Dopasowanie zdjęć z paczki ZIP do produktów i wariantów — czysta logika
 * (przeglądarka: kreator importu). Kolejność reguł:
 *
 * 1. Kolumna `images` w CSV (jawnie): `front.jpg; tyl.jpg; mint.jpg=mint; mint-m.jpg=mint+m`
 *    — plik należy do produktu z tego wiersza, a po „=” są wartości opcji.
 * 2. Nazwa pliku zaczyna się od sluga albo SKU produktu:
 *    `slug.jpg`, `slug-2.jpg` (wspólne), `slug-mint.jpg`, `SKU_mint_m_3.jpg` (warianty).
 *    Przy kilku pasujących produktach wygrywa najdłuższy prefiks
 *    („kurtka-zimowa-xl” nie trafi do „kurtka”).
 * 3. Pliki spoza tych reguł zostają „niedopasowane” — admin wybiera produkt ręcznie.
 */
import { matchFileToProduct, normalizeToken, variantKeysForValues, type VariantLike } from './variantImages'

export type CatalogProduct = {
  id: string
  sku: string
  slug: string
  title: string
  variants: VariantLike[]
  /** SHA-1 zawartości już wgranych zdjęć (z adresów Sanity) — do pomijania duplikatów */
  imageHashes: string[]
}

export type ExplicitImage = { sku: string; values: string[]; order: number }

export type FilePlan = {
  file: string
  productId: string | null
  values: string[]
  variantKeys: string[]
  order: number
  source: 'csv' | 'name' | 'manual' | null
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|tiff?)$/i

export function isImageFile(name: string): boolean {
  const base = name.split('/').pop() ?? ''
  // macOS dokłada do ZIP-ów __MACOSX/._plik — to nie są zdjęcia.
  return IMAGE_EXT.test(base) && !base.startsWith('._') && !name.includes('__MACOSX/')
}

const fileKey = (name: string) => normalizeToken((name.split('/').pop() ?? '').replace(/\.[^.]+$/, ''))

/** Kolumna `images` wiersza CSV → mapa plik → { sku, wartości }. */
export function parseImagesColumn(cell: string | undefined, sku: string, into: Map<string, ExplicitImage> = new Map()) {
  const parts = String(cell ?? '')
    .split(/[;\n,]/)
    .map((part) => part.trim())
    .filter(Boolean)
  parts.forEach((part, index) => {
    const [name, valuesPart] = part.split('=')
    const key = fileKey(name.trim())
    if (!key || /^https?:/i.test(name.trim())) return
    const values = String(valuesPart ?? '')
      .split(/[+|/]/)
      .map((value) => normalizeToken(value))
      .filter(Boolean)
    into.set(key, { sku, values, order: index })
  })
  return into
}

function optionSlugs(product: CatalogProduct): string[] {
  return product.variants.flatMap((variant) =>
    (variant.optionValues ?? []).map((option) => option?.value?.slug?.current ?? '').filter(Boolean),
  )
}

export function planZipImages(files: string[], products: CatalogProduct[], explicit: Map<string, ExplicitImage> = new Map()): FilePlan[] {
  const bySku = new Map(products.map((product) => [normalizeToken(product.sku), product]))
  const prepared = products.map((product) => ({
    product,
    prefixes: [product.slug, product.sku].map(normalizeToken).filter(Boolean),
    values: optionSlugs(product),
  }))

  return files.filter(isImageFile).map((file): FilePlan => {
    const fromCsv = explicit.get(fileKey(file))
    if (fromCsv) {
      const product = bySku.get(normalizeToken(fromCsv.sku))
      if (product) {
        return {
          file,
          productId: product.id,
          values: fromCsv.values,
          variantKeys: variantKeysForValues(product.variants, fromCsv.values),
          order: fromCsv.order,
          source: 'csv',
        }
      }
    }

    let best: { product: CatalogProduct; prefixLength: number; values: string[]; order: number } | null = null
    const key = fileKey(file)
    for (const entry of prepared) {
      const prefix = entry.prefixes.filter((p) => key === p || key.startsWith(p)).sort((a, b) => b.length - a.length)[0]
      if (!prefix || (best && prefix.length <= best.prefixLength)) continue
      const match = matchFileToProduct(file, entry.prefixes, entry.values)
      if (match) best = { product: entry.product, prefixLength: prefix.length, values: match.values, order: match.order }
    }
    if (!best) return { file, productId: null, values: [], variantKeys: [], order: 0, source: null }
    return {
      file,
      productId: best.product.id,
      values: best.values,
      variantKeys: variantKeysForValues(best.product.variants, best.values),
      order: best.order,
      source: 'name',
    }
  })
}

/**
 * Kolejność wysyłki w obrębie produktu: najpierw wspólne (pierwsze zostaje
 * zdjęciem głównym, jeśli produkt nie ma jeszcze zdjęć), potem wariantowe,
 * w każdej grupie według numeru z nazwy.
 */
export function sortPlans(plans: FilePlan[]): FilePlan[] {
  return [...plans].sort(
    (a, b) =>
      (a.productId ?? '').localeCompare(b.productId ?? '') ||
      Number(a.variantKeys.length > 0) - Number(b.variantKeys.length > 0) ||
      a.order - b.order ||
      a.file.localeCompare(b.file, 'pl', { numeric: true }),
  )
}

/** SHA-1 z adresu zdjęcia Sanity (`…/<sha1>-800x600.jpg`) — Sanity nadaje go po treści pliku. */
export function hashFromSanityUrl(url: string | null | undefined): string | null {
  const match = String(url ?? '').match(/\/([a-f0-9]{40})-\d+x\d+\.[a-z0-9]+(?:\?|$)/i)
  return match ? match[1].toLowerCase() : null
}
