import 'server-only'
import { randomUUID } from 'crypto'
import { customAlphabet } from 'nanoid'
import { sanityClient } from '@/sanity/sanityClient.server'
import {
  ensureArrayKeys,
  generateSkuForVariant,
  mapCsvRowToProductPartial,
  parseCollectionNames,
  parseDecimal,
  splitList,
} from '@/sanity/helpers/productImportHelpers'
import { buildCollectionRefs, ensureCollectionsByName } from '@/lib/admin/collections'
import { normalizeToken, pruneVariantKeys } from '@/lib/variantImages'
import { hasInfoColumns, infoSectionsFromCsvRow, infoSectionsToSanity } from '@/lib/productInfo'

/** Dawne oznaczenia rozmiaru → slug rozmiaru psa (scripts/migrate-dog-sizes.mjs). */
const SIZE_ALIASES: Record<string, string> = { xs: 'mikro', s: 'maly', m: 'sredni', l: 'duzy' }

/*
 * Import produktów z CSV (jeden wiersz = jeden produkt). Wywoływany przez
 * /api/sanity/import-csv partiami — klient dzieli plik, więc duży CSV nie
 * wisi w jednym żądaniu (limity czasu hostingu).
 *
 * Zasady, które oszczędzają adminowi pracy:
 * - Warianty = iloczyn wartości kolumn `filter_<opcja>` dla opcji z
 *   `productOptions`. Przy AKTUALIZACJI istniejące warianty (ta sama
 *   kombinacja wartości) zachowują `_key`, SKU, własną cenę i stan — więc
 *   koszyki, rejestr cen i przypisania zdjęć nie pękają przy każdym imporcie.
 * - Brakująca wartość filtra (np. nowy kolor) powstaje sama, o ile istnieje
 *   filtr (np. `color`). Brak filtra = ostrzeżenie, nie zepsuty wariant.
 * - Istniejącemu produktowi import nie zmienia sluga (adres strony), chyba
 *   że kolumna `slug` jest wypełniona.
 * - Zdjęcia NIE idą przez tę trasę — przeglądarka rozpakowuje ZIP i wysyła
 *   je po jednym (patrz components/admin/import).
 */

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12)
const raw = sanityClient.withConfig({ perspective: 'raw', useCdn: false })
const DRAFT = 'drafts.'

type Ref = { _type: 'reference'; _ref: string }
const ref = (id: string): Ref => ({ _type: 'reference', _ref: id })

type FilterDoc = { _id: string; key?: string; label?: string }
type FilterValueDoc = { _id: string; filter?: string; slug?: string; value?: string }

type ExistingVariant = { _key: string; sku?: string; price?: number; stock?: number; sig?: string[] | null }
type ExistingProduct = {
  _id: string
  slug?: string
  /** Pełny opis jako tekst — do sprawdzenia, czy CSV go naprawdę zmienia. */
  descriptionText?: string | null
  price?: number
  collectionIds?: string[] | null
  variants?: ExistingVariant[] | null
  images?: Array<{ _key: string; variantKeys?: string[] | null }> | null
}

export type ImportRowResult = {
  row: number
  ok: boolean
  action?: 'create' | 'update'
  id?: string
  sku?: string
  slug?: string
  title?: string
}

/** Stan współdzielony przez wiersze jednej partii (słowniki z Sanity pobierane raz). */
export class ImportSession {
  logs: string[] = []
  private filters: FilterDoc[] | null = null
  private values: FilterValueDoc[] | null = null
  private categories = new Map<string, string | null>()
  private subcategories = new Map<string, string | null>()

  constructor(readonly dryRun: boolean) {}

  log(line: string) {
    this.logs.push(line)
  }

  private async loadFilters() {
    if (this.filters && this.values) return
    const data = await sanityClient.fetch<{ filters: FilterDoc[]; values: FilterValueDoc[] }>(`{
      "filters": *[_type == "filter"]{ _id, key, label },
      "values": *[_type == "filterValue"]{ _id, "filter": filter._ref, "slug": slug.current, value }
    }`)
    this.filters = data.filters ?? []
    this.values = data.values ?? []
  }

  async filter(key: string): Promise<FilterDoc | null> {
    await this.loadFilters()
    const wanted = normalizeToken(key)
    return this.filters!.find((f) => normalizeToken(f.key ?? '') === wanted) ?? null
  }

  /**
   * Wartość filtra po slugu albo nazwie (bez względu na wielkość liter,
   * polskie znaki, „-”/„_”). Brakującą tworzy (poza suchą próbą).
   */
  async filterValue(filter: FilterDoc, rawValue: string): Promise<{ id: string; label: string; slug: string } | null> {
    await this.loadFilters()
    const token = normalizeToken(rawValue)
    if (!token) return null
    const inFilter = this.values!.filter((v) => v.filter === filter._id)
    const found =
      inFilter.find((v) => normalizeToken(v.slug ?? '') === token) ??
      inFilter.find((v) => normalizeToken(v.value ?? '') === token) ??
      // Stare dane: wartość bez przypiętego filtra.
      this.values!.find((v) => !v.filter && normalizeToken(v.slug ?? '') === token) ??
      // Rozmiary z dawnych CSV (S / M / L) → rozmiar psa (mały / średni / duży),
      // żeby stary plik nie tworzył z powrotem wartości „S”.
      (SIZE_ALIASES[token] ? inFilter.find((v) => normalizeToken(v.slug ?? '') === SIZE_ALIASES[token]) : undefined)
    if (found) return { id: found._id, label: found.value || rawValue.trim(), slug: found.slug || token }

    const id = `filterValue-${normalizeToken(filter.key ?? filter._id)}-${token}`.slice(0, 120)
    const doc = {
      _id: id,
      _type: 'filterValue',
      filter: ref(filter._id),
      value: rawValue.trim(),
      slug: { _type: 'slug', current: token },
    }
    if (this.dryRun) {
      this.log(`[dry-run] Zostanie utworzona wartość filtra ${filter.key}: „${doc.value}”`)
    } else {
      await sanityClient.createIfNotExists(doc)
      this.log(`Utworzono wartość filtra ${filter.key}: „${doc.value}”`)
    }
    this.values!.push({ _id: id, filter: filter._id, slug: token, value: doc.value })
    return { id, label: doc.value, slug: token }
  }

  async category(slug: string): Promise<string | null> {
    if (!this.categories.has(slug)) {
      const id = await sanityClient.fetch<string | null>(`*[_type=="category" && slug.current==$slug][0]._id`, { slug })
      this.categories.set(slug, id ?? null)
    }
    return this.categories.get(slug) ?? null
  }

  async subcategory(slug: string): Promise<string | null> {
    if (!this.subcategories.has(slug)) {
      const id = await sanityClient.fetch<string | null>(`*[_type=="subcategory" && slug.current==$slug][0]._id`, { slug })
      this.subcategories.set(slug, id ?? null)
    }
    return this.subcategories.get(slug) ?? null
  }
}

/** Kolumny `filter_*` → { klucz filtra: [wartości] } (np. { color: ['mint', 'beige'] }). */
function filterColumns(row: Record<string, string | undefined>) {
  const result: Array<{ key: string; values: string[] }> = []
  for (const column of Object.keys(row)) {
    if (!column.toLowerCase().startsWith('filter_')) continue
    const values = splitList(row[column])
    if (values.length) result.push({ key: column.slice('filter_'.length), values })
  }
  return result
}

function cartesian<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>((acc, list) => acc.flatMap((combo) => list.map((item) => [...combo, item])), [[]])
}

const signature = (refs: Array<string | null | undefined>) => refs.filter(Boolean).slice().sort().join('|')

/**
 * Pola produktu → kolumny CSV, z których powstają. Przy AKTUALIZACJI zmieniamy
 * tylko pola, których kolumny są w pliku — CSV z samą ceną nie czyści wymiarów,
 * tagów ani flag (wcześniej brak kolumny `tags` zerował tagi, a brak `dimensions`
 * nadpisywał wymiary pustym obiektem). Pusta komórka też niczego nie zmienia.
 */
const UPDATE_FIELD_COLUMNS: Record<string, string[]> = {
  title: ['title'],
  subtitle: ['subtitle'],
  intro: ['intro'],
  shortDescription: ['shortDescription'],
  price: ['price'],
  currency: ['currency'],
  compareAtPrice: ['compareAtPrice'],
  stock: ['stock'],
  brand: ['brand'],
  vendor: ['vendor'],
  tags: ['tags'],
  dimensions: ['properties_width_cm', 'properties_height_cm', 'properties_depth_cm', 'properties_units'],
  weight_g: ['weight_g'],
  material: ['material'],
  care: ['care'],
  isMachineWashable: ['isMachineWashable'],
  isWaterproof: ['isWaterproof'],
  isFeatured: ['isFeatured'],
  isBestseller: ['isBestseller'],
  isNew: ['isNew'],
  chew_strength: ['chew_strength'],
  metaTitle: ['metaTitle'],
  metaDescription: ['metaDescription'],
  indexedOptions: ['productOptions'],
}

const plainText = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim()

export async function importProductRow(
  session: ImportSession,
  row: Record<string, string | undefined>,
  rowNumber: number,
): Promise<ImportRowResult> {
  const { dryRun } = session
  const partial = mapCsvRowToProductPartial(row) as Record<string, unknown> & {
    sku?: string
    title?: string
    price?: number
    stock?: number
    slug?: { current?: string }
  }
  // `images` z CSV to NAZWY PLIKÓW z ZIP-a (obsługuje je przeglądarka), nie dane do zapisu.
  delete partial.images
  delete partial.options
  // `visibility` to stare pole bez znaczenia w sklepie — o widoczności decyduje
  // publikacja (szkic / opublikowany), więc import go nie ustawia.
  delete partial.visibility

  if (!partial.sku) throw new Error('Brak SKU — po nim import rozpoznaje produkt.')

  // Zakładki „Informacje o produkcie” z kolumn `info_<Tytuł>` (np. info_Skład).
  // Gdy plik je ma, ustawiają zakładki w całości i zastępują stare pola material/care.
  const withInfo = hasInfoColumns(row)
  if (withInfo) {
    partial.infoSections = infoSectionsToSanity(infoSectionsFromCsvRow(row))
    delete partial.material
    delete partial.care
  }

  // Kategoria i subkategoria.
  if (row.category_slug) {
    const id = await session.category(row.category_slug.trim())
    if (id) partial.category = ref(id)
    else {
      delete partial.category
      session.log(`CATEGORY NOT FOUND for slug: ${row.category_slug}`)
    }
  } else delete partial.category
  if (row.type) {
    const id = await session.subcategory(row.type.trim())
    if (id) partial.type = ref(id)
    else {
      delete partial.type
      session.log(`SUBCATEGORY NOT FOUND for slug: ${row.type}`)
    }
  }

  // Kolekcje — brakujące powstają jako szkic; przy aktualizacji są DOKŁADANE.
  const collectionNames = parseCollectionNames(row)
  let collectionIds: string[] = []
  if (collectionNames.length) {
    const { ids, created } = await ensureCollectionsByName(collectionNames, { dryRun })
    collectionIds = ids
    if (created.length) session.log(`${dryRun ? '[dry-run] Utworzono by' : 'Utworzono'} szkic kolekcji: ${created.join(', ')}`)
  }

  // Opcje wariantów i wartości filtrów.
  const optionKeys = splitList(row.productOptions ?? '').map((key) => normalizeToken(key))
  const optionRefs: Ref[] = []
  const valueRefs: Ref[] = []
  const options: Array<{ filter: FilterDoc; values: Array<{ id: string; label: string; slug: string }> }> = []
  for (const key of optionKeys) {
    const filter = await session.filter(key)
    if (filter) optionRefs.push(ref(filter._id))
    else session.log(`FilterOption NOT FOUND for key: ${key}`)
  }
  for (const column of filterColumns(row)) {
    const filter = await session.filter(column.key)
    if (!filter) {
      session.log(`Filter NOT FOUND for column filter_${column.key} — dodaj filtr „${column.key}” w Studio`)
      continue
    }
    const resolved = []
    for (const value of column.values) {
      const found = await session.filterValue(filter, value)
      if (found) {
        resolved.push(found)
        valueRefs.push(ref(found.id))
      }
    }
    if (optionKeys.includes(normalizeToken(column.key)) && resolved.length) options.push({ filter, values: resolved })
  }
  partial.productOptions = optionRefs.length ? ensureArrayKeys(optionRefs) : []
  partial.filterValues = ensureArrayKeys(valueRefs) ?? []

  // Istniejący produkt (opublikowany i/lub szkic).
  const versions = await raw.fetch<ExistingProduct[]>(
    `*[_type == "product" && sku == $sku && !(_id in path("versions.**"))]{
      _id, "slug": slug.current, price, "collectionIds": collections[]._ref,
      "descriptionText": pt::text(description),
      variants[]{ _key, sku, price, stock, "sig": optionValues[].value._ref },
      images[]{ _key, variantKeys }
    }`,
    { sku: partial.sku },
  )
  const existing = versions.find((doc) => !doc._id.startsWith(DRAFT)) ?? versions[0] ?? null

  // Warianty: iloczyn opcji; istniejące kombinacje zachowują klucz, SKU, cenę i stan.
  if (options.length) {
    const byTokens = new Map((existing?.variants ?? []).map((variant) => [signature(variant.sig ?? []), variant]))
    let kept = 0
    const csvStock = parseDecimal(row.stock)
    partial.variants = cartesian(options.map((option) => option.values.map((value) => ({ option, value })))).map(
      (combo, index) => {
        const sig = signature(combo.map(({ value }) => value.id))
        const previous = byTokens.get(sig)
        if (previous) kept += 1
        const optionMap = Object.fromEntries(combo.map(({ option, value }) => [option.filter.key ?? '', value.slug]))
        // Cena wariantu równa starej cenie produktu to tylko kopia (stary import) —
        // usuwamy ją, żeby wariant dziedziczył nową cenę z CSV.
        const ownPrice =
          previous && typeof previous.price === 'number' && previous.price !== existing?.price ? previous.price : undefined
        return {
          _key: previous?._key ?? nanoid(),
          sku: previous?.sku || generateSkuForVariant(partial.sku, index, optionMap),
          ...(ownPrice !== undefined ? { price: ownPrice } : {}),
          ...(csvStock !== undefined && Number.isFinite(csvStock)
            ? { stock: csvStock }
            : typeof previous?.stock === 'number'
              ? { stock: previous.stock }
              : {}),
          optionValues: combo.map(({ option, value }) => ({
            _key: nanoid(),
            label: `${option.filter.label || option.filter.key}: ${value.label}`,
            name: ref(option.filter._id),
            value: ref(value.id),
          })),
          indexedOptions: combo.map(({ option, value }) => `${normalizeToken(option.filter.key ?? '')}:${value.slug}`),
        }
      },
    )
    const removed = byTokens.size - kept
    if (removed > 0) session.log(`SKU ${partial.sku}: ${removed} wariantów nie ma już w CSV — usunięte z produktu`)
  } else {
    delete partial.variants
  }

  if (collectionIds.length) {
    const current = (existing?.collectionIds ?? []).filter((id): id is string => typeof id === 'string')
    partial.collections = buildCollectionRefs([...current, ...collectionIds])
  }

  const slug = partial.slug?.current
  const result: ImportRowResult = { row: rowNumber, ok: true, sku: partial.sku, title: String(partial.title ?? ''), slug }

  if (dryRun) {
    session.log(`[dry-run] ${rowNumber}: SKU ${partial.sku} → ${existing ? 'UPDATE' : 'CREATE'} (bez zapisu)`)
    return {
      ...result,
      action: existing ? 'update' : 'create',
      id: existing?._id.replace(DRAFT, ''),
      slug: existing && !row.slug?.trim() ? existing.slug : slug,
    }
  }

  if (existing) {
    // Adres istniejącego produktu zmieniamy tylko na wyraźne życzenie (kolumna slug).
    if (!row.slug?.trim()) delete partial.slug
    // Tylko pola z kolumn obecnych w pliku (patrz UPDATE_FIELD_COLUMNS).
    for (const [field, columns] of Object.entries(UPDATE_FIELD_COLUMNS)) {
      if (!columns.some((column) => column in row)) delete partial[field]
    }
    // Pusta komórka productOptions = opcje i warianty bez zmian (jak każda pusta komórka).
    if (!row.productOptions?.trim()) delete partial.productOptions
    if (!Object.keys(row).some((column) => column.toLowerCase().startsWith('filter_'))) delete partial.filterValues
    // Pełny opis: CSV niesie go jako zwykły tekst. Pusta komórka albo ten sam
    // tekst co w sklepie (np. plik z eksportu) = zostawiamy opis z formatowaniem
    // (nagłówki, listy, zdjęcia). Wcześniej pusty opis zastępowano krótkim opisem.
    if (!row.description?.trim() || plainText(row.description) === plainText(existing.descriptionText)) {
      delete partial.description
    }
    const variantKeys = ((partial.variants as Array<{ _key: string }> | undefined) ?? existing.variants ?? []).map((v) => v._key)
    const tx = raw.transaction()
    for (const version of versions) {
      const payload: Record<string, unknown> = { ...partial }
      delete payload._type
      // Zdjęcia zostają; znikają tylko przypisania do usuniętych wariantów.
      if (partial.variants) {
        for (const image of version.images ?? []) {
          if (!image.variantKeys?.length) continue
          const pruned = pruneVariantKeys(image.variantKeys, variantKeys)
          if (pruned.length === image.variantKeys.length) continue
          if (!pruned.length) {
            // Zdjęcie tylko usuniętych wariantów NIE staje się wspólne (pokazałoby
            // się przy każdym wariancie) — zostaje ukryte do decyzji w panelu.
            session.log(`SKU ${partial.sku}: zdjęcie ${image._key} należało tylko do usuniętych wariantów — ukryte (przypisz albo usuń je w panelu)`)
            continue
          }
          payload[`images[_key=="${image._key}"].variantKeys`] = pruned
        }
      }
      tx.patch(version._id, (patch) => (withInfo ? patch.set(payload).unset(['material', 'care']) : patch.set(payload)))
    }
    await tx.commit()
    const id = existing._id.replace(DRAFT, '')
    session.log(`Updated ${rowNumber}: ${id} (SKU: ${partial.sku})`)
    return { ...result, action: 'update', id, slug: row.slug?.trim() ? slug : existing.slug }
  }

  // Nowy produkt powstaje jako SZKIC (`drafts.<id>`) — sklep go nie widzi, dopóki
  // admin nie opublikuje go w Katalogu (także hurtowo: zaznacz → „Opublikuj”).
  // Dzięki temu import można sprawdzić (zdjęcia, ceny, warianty) przed wejściem do sklepu.
  const id = randomUUID()
  await raw.create({ ...(partial as Record<string, unknown>), _id: `${DRAFT}${id}`, _type: 'product' })
  session.log(`Created ${rowNumber}: ${id} (SKU: ${partial.sku}, szkic)`)
  return { ...result, action: 'create', id }
}
