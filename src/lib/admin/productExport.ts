import 'server-only'
import Papa from 'papaparse'
import { sanityClient } from '@/sanity/sanityClient.server'
import { INFO_CSV_PREFIX, productInfoSections } from '@/lib/productInfo'
import { absoluteUrl } from '@/lib/site'

/*
 * Eksport katalogu do CSV w FORMACIE IMPORTU (/admin/import): ten sam układ
 * kolumn, więc plik można poprawić w Excelu i wgrać z powrotem — import
 * rozpozna produkty po SKU i zaktualizuje je.
 *
 * Zasady, dzięki którym eksport → import niczego nie psuje:
 * - Produkty z wariantami mają PUSTĄ kolumnę `stock` (pusta = stany bez zmian);
 *   stany i ceny wariantów są w kolumnach informacyjnych `stany_wariantow`
 *   i `ceny_wariantow` (import ich nie czyta — stany ustawia się w Katalogu).
 * - Pełny opis idzie jako zwykły tekst. Import zostawia opis z formatowaniem,
 *   jeśli tekst się nie zmienił (lib/admin/productImport.ts).
 * - Zakładki „Informacje o produkcie” → kolumny `info_<Tytuł>` (lib/productInfo.ts).
 * - Separator „;” i BOM — polski Excel otwiera plik od razu w kolumnach,
 *   a import sam rozpoznaje separator.
 * Szkic ma pierwszeństwo przed wersją opublikowaną (to najnowsze zmiany).
 */

const raw = sanityClient.withConfig({ perspective: 'raw', useCdn: false })
const baseId = (id: string) => id.replace(/^drafts\./, '')

type ExportOption = { key?: string | null; label?: string | null }
type ExportValue = { key?: string | null; value?: string | null; slug?: string | null }
type ExportVariant = {
  sku?: string | null
  price?: number | null
  stock?: number | null
  label?: string | null
  values?: Array<{ key?: string | null; value?: string | null; slug?: string | null } | null> | null
}
type ExportDoc = {
  _id: string
  title?: string | null
  subtitle?: string | null
  intro?: string | null
  sku?: string | null
  slug?: string | null
  shortDescription?: string | null
  descriptionText?: string | null
  metaTitle?: string | null
  metaDescription?: string | null
  price?: number | null
  currency?: string | null
  stock?: number | null
  categorySlug?: string | null
  subcategorySlug?: string | null
  brand?: string | null
  vendor?: string | null
  tags?: string[] | null
  options?: Array<ExportOption | null> | null
  filterValues?: Array<ExportValue | null> | null
  variants?: ExportVariant[] | null
  dimensions?: { width_cm?: number | null; height_cm?: number | null; depth_cm?: number | null; unit?: string | null } | null
  weight_g?: number | null
  infoSections?: unknown
  material?: string | null
  care?: string | null
  isMachineWashable?: boolean | null
  isWaterproof?: boolean | null
  isFeatured?: boolean | null
  isBestseller?: boolean | null
  isNew?: boolean | null
  chew_strength?: string | null
  collections?: Array<string | null> | null
  imageUrls?: Array<string | null> | null
}

const QUERY = `*[_type == "product" && !(_id in path("versions.**"))] | order(title asc) {
  _id, title, subtitle, intro, sku, "slug": slug.current, shortDescription,
  "descriptionText": pt::text(description),
  metaTitle, metaDescription, price, currency, stock,
  "categorySlug": category->slug.current,
  "subcategorySlug": type->slug.current,
  brand, vendor, tags,
  "options": productOptions[]->{ key, label },
  "filterValues": filterValues[]->{ "key": filter->key, value, "slug": slug.current },
  "variants": variants[]{
    sku, price, stock, "label": array::join(optionValues[].label, " · "),
    "values": optionValues[]{ "key": name->key, "value": value->value, "slug": value->slug.current }
  },
  dimensions, weight_g, infoSections, material, care,
  isMachineWashable, isWaterproof, isFeatured, isBestseller, isNew, chew_strength,
  "collections": collections[]->title,
  "imageUrls": images[].asset->url
}`

const num = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? String(value) : '')
const bool = (value: boolean | null | undefined) => (value ? 'true' : 'false')
const text = (value: string | null | undefined) => String(value ?? '').trim()

/** Wartość filtra do komórki: nazwa (czytelna), a gdy ma „;” lub „,” — slug (separator listy). */
const cellValue = (value: { value?: string | null; slug?: string | null }) => {
  const name = text(value.value)
  return name && !/[;,]/.test(name) ? name : text(value.slug) || name.replace(/[;,]/g, ' ')
}

export type ProductExport = { csv: string; fileName: string; count: number }

export async function exportProductsCsv(): Promise<ProductExport> {
  const docs = await raw.fetch<ExportDoc[]>(QUERY)

  // Jedna pozycja na produkt: szkic (najnowszy stan) przed wersją opublikowaną.
  const byId = new Map<string, { doc: ExportDoc; status: string }>()
  for (const doc of docs ?? []) {
    const id = baseId(doc._id)
    const isDraft = doc._id !== id
    const previous = byId.get(id)
    if (!previous) {
      byId.set(id, { doc, status: isDraft ? 'szkic' : 'opublikowany' })
    } else if (isDraft) {
      byId.set(id, { doc, status: 'opublikowany (zmiany w szkicu)' })
    } else {
      previous.status = 'opublikowany (zmiany w szkicu)'
    }
  }
  const products = [...byId.values()]

  // Kolumny filtrów: najpierw opcje wariantów, potem pozostałe filtry — w kolejności wystąpienia.
  const filterKeys: string[] = []
  const addKey = (key: string | null | undefined) => {
    const clean = text(key)
    if (clean && !filterKeys.includes(clean)) filterKeys.push(clean)
  }
  for (const { doc } of products) (doc.options ?? []).forEach((option) => addKey(option?.key))
  for (const { doc } of products) (doc.filterValues ?? []).forEach((value) => addKey(value?.key))

  // Kolumny zakładek: najpierw Skład i Dodatkowe informacje, potem inne tytuły.
  const infoTitles: string[] = ['Skład', 'Dodatkowe informacje']
  const infoByProduct = new Map<string, Map<string, string>>()
  for (const [id, { doc }] of byId) {
    const sections = productInfoSections(doc)
    const map = new Map<string, string>()
    for (const section of sections) {
      if (!infoTitles.some((title) => title.toLocaleLowerCase('pl') === section.title.toLocaleLowerCase('pl'))) infoTitles.push(section.title)
      const column = infoTitles.find((title) => title.toLocaleLowerCase('pl') === section.title.toLocaleLowerCase('pl'))!
      map.set(column, section.body)
    }
    infoByProduct.set(id, map)
  }

  const fields = [
    'title', 'subtitle', 'intro', 'sku', 'slug', 'shortDescription', 'description', 'metaTitle', 'metaDescription',
    'price', 'currency', 'stock', 'category_slug', 'type', 'brand', 'vendor', 'tags', 'productOptions',
    ...filterKeys.map((key) => `filter_${key}`),
    'properties_width_cm', 'properties_height_cm', 'properties_depth_cm', 'properties_units', 'weight_g',
    ...infoTitles.map((title) => `${INFO_CSV_PREFIX}${title}`),
    'isMachineWashable', 'isWaterproof', 'isFeatured', 'isBestseller', 'isNew', 'chew_strength', 'collections',
    // Kolumny informacyjne — import ich nie czyta.
    'status', 'stany_wariantow', 'ceny_wariantow', 'zdjecia_url', 'link',
  ]

  const data = [...byId.entries()].map(([id, { doc, status }]) => {
    const variants = (doc.variants ?? []).filter(Boolean)
    const allOptionKeys = (doc.options ?? []).map((option) => text(option?.key)).filter(Boolean)
    // Import buduje warianty jako KOMPLET kombinacji wartości. Produkt, którego
    // warianty nie są kompletem (np. ułożone ręcznie w Studio), dostaje pustą
    // kolumnę productOptions — import zostawi wtedy jego warianty bez zmian.
    const distinct = allOptionKeys.map(
      (key) => new Set(variants.flatMap((variant) => (variant.values ?? []).filter((value) => text(value?.key) === key).map((value) => text(value?.slug) || text(value?.value)))).size,
    )
    const fullGrid = variants.length > 0 && distinct.every((size) => size > 0) && distinct.reduce((product, size) => product * size, 1) === variants.length
    const optionKeys = fullGrid ? allOptionKeys : []

    // Wartości filtra: z wariantów (kolejność wariantów) + przypisane do produktu.
    const valuesFor = (key: string) => {
      const list: string[] = []
      const push = (value: { value?: string | null; slug?: string | null } | null | undefined) => {
        if (!value) return
        const cell = cellValue(value)
        if (cell && !list.some((entry) => entry.toLocaleLowerCase('pl') === cell.toLocaleLowerCase('pl'))) list.push(cell)
      }
      for (const variant of variants) for (const value of variant.values ?? []) if (text(value?.key) === key) push(value)
      for (const value of doc.filterValues ?? []) if (text(value?.key) === key) push(value)
      return list.join(';')
    }

    const info = infoByProduct.get(id) ?? new Map<string, string>()
    const dims = doc.dimensions ?? {}
    const row: Record<string, string> = {
      title: text(doc.title),
      subtitle: text(doc.subtitle),
      intro: text(doc.intro),
      sku: text(doc.sku),
      slug: text(doc.slug),
      shortDescription: text(doc.shortDescription),
      description: text(doc.descriptionText),
      metaTitle: text(doc.metaTitle),
      metaDescription: text(doc.metaDescription),
      price: num(doc.price),
      currency: text(doc.currency) || 'PLN',
      // Z wariantami: pusto = import nie zmieni stanów wariantów.
      stock: variants.length ? '' : num(doc.stock),
      category_slug: text(doc.categorySlug),
      type: text(doc.subcategorySlug),
      brand: text(doc.brand),
      vendor: text(doc.vendor),
      tags: (doc.tags ?? []).map(text).filter(Boolean).join(';'),
      productOptions: optionKeys.join(';'),
      properties_width_cm: num(dims.width_cm),
      properties_height_cm: num(dims.height_cm),
      properties_depth_cm: num(dims.depth_cm),
      properties_units: text(dims.unit),
      weight_g: num(doc.weight_g),
      isMachineWashable: bool(doc.isMachineWashable),
      isWaterproof: bool(doc.isWaterproof),
      isFeatured: bool(doc.isFeatured),
      isBestseller: bool(doc.isBestseller),
      isNew: bool(doc.isNew),
      chew_strength: text(doc.chew_strength),
      collections: (doc.collections ?? []).map((name) => text(name)).filter(Boolean).join('; '),
      status: !fullGrid && variants.length ? `${status}; warianty ułożone ręcznie — import ich nie zmieni` : status,
      stany_wariantow: variants
        .map((variant) => `${text(variant.label) || text(variant.sku) || 'wariant'}=${num(variant.stock) || '—'}`)
        .join(' | '),
      ceny_wariantow: variants
        .filter((variant) => typeof variant.price === 'number')
        .map((variant) => `${text(variant.label) || text(variant.sku) || 'wariant'}=${num(variant.price)}`)
        .join(' | '),
      zdjecia_url: (doc.imageUrls ?? []).filter(Boolean).join(' '),
      link: doc.slug ? absoluteUrl(`/product/${doc.slug}`) : '',
    }
    for (const key of filterKeys) row[`filter_${key}`] = valuesFor(key)
    for (const title of infoTitles) row[`${INFO_CSV_PREFIX}${title}`] = info.get(title) ?? ''
    return fields.map((field) => row[field] ?? '')
  })

  const csv = Papa.unparse({ fields, data }, { delimiter: ';', newline: '\r\n' })
  const date = new Date().toISOString().slice(0, 10)
  return { csv, fileName: `produkty_${date}.csv`, count: data.length }
}
