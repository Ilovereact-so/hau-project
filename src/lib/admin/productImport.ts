import 'server-only'
import { randomUUID } from 'crypto'
import { customAlphabet } from 'nanoid'
import { sanityClient } from '@/sanity/sanityClient.server'
import {
  ensureArrayKeys,
  generateSkuForVariant,
  mapCsvRowToProductPartial,
  parseBoolean,
  parseCollectionNames,
  parseDecimal,
  splitList,
} from '@/sanity/helpers/productImportHelpers'
import { assignVariantColumn, pairsFromLabel, parseVariantColumn, type MatchableVariant } from '@/lib/importVariantColumns'
import { buildCollectionRefs, ensureCollectionsByName } from '@/lib/admin/collections'
import { normalizeToken, pruneVariantKeys } from '@/lib/variantImages'
import { hasInfoColumns, infoSectionsFromCsvRow, infoSectionsToSanity, productInfoSections } from '@/lib/productInfo'

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
 * - Brakująca wartość filtra (np. nowy kolor) powstaje sama; nieznana
 *   kolumna `filter_<x>` zakłada nowy filtr (`createFilter`).
 * - AKTUALIZACJA (po SKU): plik nadpisuje — kolumna obecna w pliku zastępuje
 *   dane, także pustą komórką; kolumn spoza pliku import nie rusza. Szczegóły
 *   przy `importProductRow`. Istniejącemu produktowi import nie zmienia sluga
 *   (adres strony), chyba że kolumna `slug` jest wypełniona.
 * - Zdjęcia NIE idą przez tę trasę — przeglądarka rozpakowuje ZIP i wysyła
 *   je po jednym (patrz components/admin/import).
 */

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12)
const raw = sanityClient.withConfig({ perspective: 'raw', useCdn: false })
const DRAFT = 'drafts.'
/** `_id` filtrów zakładanych przez import z nowej kolumny `filter_*` (ImportSession.createFilter). */
const IMPORTED_FILTER_PREFIX = 'filter-import-'

type Ref = { _type: 'reference'; _ref: string }
const ref = (id: string): Ref => ({ _type: 'reference', _ref: id })

type FilterDoc = { _id: string; key?: string; label?: string }
type FilterValueDoc = { _id: string; filter?: string; slug?: string; value?: string }

type ExistingVariant = { _key: string; sku?: string; price?: number; stock?: number; sig?: string[] | null; label?: string | null }
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
  /** Podgląd zmian (krok „Sprawdź”) — także przy zapisie. */
  diff?: ProductDiff
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
   * Nowy filtr z kolumny `filter_<nazwa>`, której nie zna sklep (np.
   * `filter_pojemność`). Powstaje jako lista wartości (`enum`,
   * `only-value-list`) z nazwą z nagłówka — dzięki temu dodanie nowego
   * parametru/opcji wariantu nie wymaga wcześniejszej wizyty w Studio.
   * `_id` = `filter-import-<klucz>` (deterministyczne, bez duplikatów między
   * partiami); po tym prefiksie import rozpoznaje filtry, które sam założył
   * (`ensureSubcategoryFilter`). Etykietę i UX_type można potem zmienić w Studio.
   */
  async createFilter(rawKey: string): Promise<FilterDoc | null> {
    await this.loadFilters()
    const key = normalizeToken(rawKey)
    if (!key) return null
    const existing = this.filters!.find((f) => normalizeToken(f.key ?? '') === key)
    if (existing) return existing
    const words = rawKey.replace(/[_-]+/g, ' ').trim()
    const label = (words.charAt(0).toUpperCase() + words.slice(1)).slice(0, 60) || key
    const doc = { _id: `${IMPORTED_FILTER_PREFIX}${key}`.slice(0, 120), _type: 'filter', key, label, type: 'enum', UX_type: 'only-value-list' }
    if (this.dryRun) {
      this.log(`[dry-run] Zostanie utworzony nowy filtr „${label}” (klucz ${key}) z kolumny filter_${rawKey}`)
    } else {
      await sanityClient.createIfNotExists(doc)
      this.log(`Utworzono nowy filtr „${label}” (klucz ${key}) z kolumny filter_${rawKey} — nazwę i wygląd (lista / próbki ze zdjęciami) zmienisz w Studio`)
    }
    const created: FilterDoc = { _id: doc._id, key, label }
    this.filters!.push(created)
    return created
  }

  private subcategoryFilterChecked = new Set<string>()

  /**
   * Filtr założony przez import (`filter-import-*`) dopinamy do filtrów
   * podkategorii produktu (`availableFilters`), żeby od razu pojawił się
   * w filtrach listingu. Istniejących filtrów (kolor, rozmiar psa) NIE
   * dopinamy — ich zestaw na podkategorii ustawia się świadomie w Studio.
   */
  async ensureSubcategoryFilter(subcategoryId: string, filter: FilterDoc) {
    if (!filter._id.startsWith(IMPORTED_FILTER_PREFIX)) return
    const cacheKey = `${subcategoryId}:${filter._id}`
    if (this.subcategoryFilterChecked.has(cacheKey)) return
    this.subcategoryFilterChecked.add(cacheKey)
    const versions = await raw.fetch<Array<{ _id: string; title?: string; refs?: string[] | null }>>(
      `*[_id in [$id, $draft]]{ _id, title, "refs": availableFilters[]._ref }`,
      { id: subcategoryId, draft: `${DRAFT}${subcategoryId}` },
    )
    const missing = versions.filter((version) => !(version.refs ?? []).includes(filter._id))
    if (!missing.length) return
    const title = versions[0]?.title ?? subcategoryId
    if (this.dryRun) {
      this.log(`[dry-run] Filtr „${filter.label ?? filter.key}” zostanie dodany do filtrów podkategorii „${title}”`)
      return
    }
    const tx = sanityClient.transaction()
    for (const version of missing) {
      tx.patch(version._id, (patch) =>
        patch.setIfMissing({ availableFilters: [] }).append('availableFilters', [{ _type: 'reference', _ref: filter._id, _key: nanoid() }]),
      )
    }
    await tx.commit()
    this.log(`Dodano filtr „${filter.label ?? filter.key}” do filtrów podkategorii „${title}”`)
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

function cartesian<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>((acc, list) => acc.flatMap((combo) => list.map((item) => [...combo, item])), [[]])
}

const signature = (refs: Array<string | null | undefined>) => refs.filter(Boolean).slice().sort().join('|')

// ─── aktualizacja: plik nadpisuje ────────────────────────────────────────────

/*
 * Zasada aktualizacji (SKU = identyfikator produktu):
 *   - kolumna OBECNA w pliku nadpisuje pole — także pustą wartością
 *     (pusta komórka czyści pole: opis, wymiary, tagi, zakładki…);
 *   - kolumny, której w pliku NIE MA, import nie dotyka (plik z samym SKU
 *     i ceną zmienia tylko cenę);
 *   - wyjątki, których pusta komórka NIE czyści: nazwa, cena (wymagane),
 *     waluta i slug (adres strony zmienia się tylko na wyraźne życzenie);
 *   - kolumna `filter_<x>` zastępuje wartości TEGO filtra; parametry filtrów
 *     spoza pliku zostają;
 *   - `productOptions` puste = produkt bez wariantów (warianty są usuwane),
 *     chyba że wiersz wymienia warianty w `stany_wariantow`/`ceny_wariantow`
 *     (plik z eksportu dla wariantów ułożonych ręcznie) — wtedy warianty
 *     zostają, a stany/ceny się aktualizują;
 *   - stany i ceny wariantów: `stany_wariantow` / `ceny_wariantow`
 *     (lib/importVariantColumns.ts); bez nich kolumna `stock` daje ten sam
 *     stan każdemu wariantowi.
 * Każdy wiersz zwraca `diff` — podgląd „przed → po” dla kroku „Sprawdź”.
 */

export type FieldChange = { field: string; label: string; before: string; after: string; kind: 'added' | 'changed' | 'cleared' }

export type VariantDiff = {
  /** Etykiety wariantów nowych, usuniętych i liczba zachowanych. */
  added: string[]
  removed: string[]
  kept: number
  total: number
  /** Stany i ceny, które się zmieniają (tylko zmienione). */
  values: Array<{ label: string; stockBefore: string; stockAfter: string; priceBefore: string; priceAfter: string }>
}

export type ProductDiff = {
  fields: FieldChange[]
  /** `null` = struktura wariantów bez zmian (i bez zmian stanów/cen). */
  variants: VariantDiff | null
  warnings: string[]
  /** Usuwa dane: warianty albo czyści pola. */
  destructive: boolean
  /** Aktualizacja, która niczego nie zmienia. */
  unchanged: boolean
}

type SimpleKind = 'text' | 'longtext' | 'money' | 'number' | 'int' | 'bool'
type SimpleField = { field: string; column: string; label: string; kind: SimpleKind; keepIfEmpty?: boolean }

/** Pola 1:1 z kolumnami (reszta — kategorie, filtry, warianty, zakładki — niżej). */
const SIMPLE_FIELDS: SimpleField[] = [
  { field: 'title', column: 'title', label: 'Nazwa', kind: 'text', keepIfEmpty: true },
  { field: 'subtitle', column: 'subtitle', label: 'Podtytuł', kind: 'text' },
  { field: 'intro', column: 'intro', label: 'Wstęp (listingi)', kind: 'longtext' },
  { field: 'shortDescription', column: 'shortDescription', label: 'Krótki opis', kind: 'longtext' },
  { field: 'metaTitle', column: 'metaTitle', label: 'Tytuł w Google', kind: 'text' },
  { field: 'metaDescription', column: 'metaDescription', label: 'Opis w Google', kind: 'longtext' },
  { field: 'price', column: 'price', label: 'Cena', kind: 'money', keepIfEmpty: true },
  { field: 'currency', column: 'currency', label: 'Waluta', kind: 'text', keepIfEmpty: true },
  { field: 'compareAtPrice', column: 'compareAtPrice', label: 'Cena przekreślona (nieużywana)', kind: 'money' },
  { field: 'stock', column: 'stock', label: 'Stan', kind: 'int' },
  { field: 'brand', column: 'brand', label: 'Marka', kind: 'text' },
  { field: 'vendor', column: 'vendor', label: 'Dostawca', kind: 'text' },
  { field: 'weight_g', column: 'weight_g', label: 'Waga (g)', kind: 'number' },
  { field: 'material', column: 'material', label: 'Materiał (stare pole)', kind: 'longtext' },
  { field: 'care', column: 'care', label: 'Pielęgnacja (stare pole)', kind: 'longtext' },
  { field: 'isMachineWashable', column: 'isMachineWashable', label: 'Pranie w pralce', kind: 'bool' },
  { field: 'isWaterproof', column: 'isWaterproof', label: 'Wodoodporny', kind: 'bool' },
  { field: 'isFeatured', column: 'isFeatured', label: 'Polecamy', kind: 'bool' },
  { field: 'isBestseller', column: 'isBestseller', label: 'Bestseller', kind: 'bool' },
  { field: 'isNew', column: 'isNew', label: 'Nowość', kind: 'bool' },
  { field: 'chew_strength', column: 'chew_strength', label: 'Twardość gryzienia', kind: 'text' },
]

const DIMENSION_COLUMNS = ['properties_width_cm', 'properties_height_cm', 'properties_depth_cm', 'properties_units']
const STOCK_COLUMN = 'stany_wariantow'
const PRICE_COLUMN = 'ceny_wariantow'

const plainText = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim()
const has = (row: Record<string, string | undefined>, column: string) => Object.prototype.hasOwnProperty.call(row, column)
const isEmptyValue = (value: unknown) =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0) ||
  (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0)

const money = (value: unknown) =>
  typeof value === 'number' ? `${value.toFixed(2).replace('.', ',')} zł` : ''
const short = (value: string, max = 70) => (value.length > max ? `${value.slice(0, max - 1)}…` : value)

function show(kind: SimpleKind | 'list' | 'dims' | 'ref', value: unknown): string {
  if (isEmptyValue(value)) return ''
  if (kind === 'money') return money(value)
  if (kind === 'bool') return value ? 'tak' : 'nie'
  if (kind === 'list') return (value as unknown[]).map(String).join(', ')
  if (kind === 'dims') {
    const d = value as Record<string, unknown>
    const size = [d.width_cm, d.height_cm, d.depth_cm].map((v) => (typeof v === 'number' ? String(v) : '–')).join(' × ')
    return `${size}${d.unit ? ` ${d.unit}` : ''}`
  }
  return short(plainText(value))
}

const sameValue = (a: unknown, b: unknown) => {
  // Brak wartości ≠ 0: GROQ zwraca brak pola jako null, a Number(null) === 0 —
  // bez tego „stock: 0” z pliku nie trafiał do produktu bez stanu (zostawał
  // „nieprowadzony” = zawsze dostępny, mimo że w pliku jest 0 sztuk).
  const emptyA = isEmptyValue(a)
  const emptyB = isEmptyValue(b)
  if (emptyA || emptyB) return emptyA && emptyB
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b)
  if (typeof a === 'string' || typeof b === 'string') return plainText(a) === plainText(b)
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

type ExistingFull = ExistingProduct & Record<string, unknown> & {
  title?: string
  categorySlug?: string | null
  typeSlug?: string | null
  collectionNames?: Array<string | null> | null
  filterRefs?: Array<{ id?: string | null; filter?: string | null; value?: string | null } | null> | null
  optionIds?: string[] | null
  infoSections?: Array<{ title?: string; body?: string } | null> | null
  variants?: Array<ExistingVariant & { label?: string | null }> | null
}

const EXISTING_PROJECTION = `{
  _id, title, subtitle, intro, shortDescription, metaTitle, metaDescription, price, currency, compareAtPrice, stock,
  brand, vendor, tags, dimensions, weight_g, material, care,
  isMachineWashable, isWaterproof, isFeatured, isBestseller, isNew, chew_strength,
  "slug": slug.current, "descriptionText": pt::text(description),
  "categoryId": category._ref, "categorySlug": category->slug.current,
  "typeId": type._ref, "typeSlug": type->slug.current,
  "collectionIds": collections[]._ref, "collectionNames": collections[]->title,
  "filterRefs": filterValues[]{ "id": _ref, "filter": @->filter._ref, "value": @->value },
  "optionIds": productOptions[]._ref,
  infoSections[]{ title, body },
  variants[]{ _key, sku, price, stock, "sig": optionValues[].value._ref, "label": array::join(optionValues[].label, " · ") },
  images[]{ _key, variantKeys }
}`

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
  const sku = String(row.sku ?? '').trim()
  if (!sku) throw new Error('Brak SKU — po nim import rozpoznaje produkt.')
  partial.sku = sku
  const warnings: string[] = []
  const warn = (message: string) => {
    warnings.push(message)
    session.log(`UWAGA: SKU ${sku}: ${message}`)
  }

  // Istniejący produkt (opublikowany i/lub szkic). Podgląd porównuje z NAJNOWSZĄ
  // wersją (szkic, jeśli jest), zapis trafia do obu.
  const versions = await raw.fetch<ExistingFull[]>(
    `*[_type == "product" && sku == $sku && !(_id in path("versions.**"))]${EXISTING_PROJECTION}`,
    { sku },
  )
  const published = versions.find((doc) => !doc._id.startsWith(DRAFT)) ?? null
  const current = versions.find((doc) => doc._id.startsWith(DRAFT)) ?? published
  const isUpdate = Boolean(current)

  const set: Record<string, unknown> = {}
  const unset = new Set<string>()
  const fields: FieldChange[] = []
  const record = (field: string, label: string, before: string, after: string) => {
    if (before === after) return
    fields.push({ field, label, before, after, kind: !before ? 'added' : !after ? 'cleared' : 'changed' })
  }
  /** Pole z kolumny obecnej w pliku: pusta wartość czyści. */
  const assign = (field: string, label: string, value: unknown, kind: Parameters<typeof show>[0], before: unknown) => {
    // Flaga: brak = „nie” (eksport zapisuje brak jako false). Wymiary: porównanie
    // wartości, nie kolejności kluczy w obiekcie.
    if (kind === 'bool' ? Boolean(before) === Boolean(value) : kind === 'dims' ? show('dims', before) === show('dims', value) : sameValue(before, value)) return
    if (kind === 'bool' && !value) {
      unset.add(field)
      record(field, label, show(kind, before), 'nie')
      return
    }
    if (isEmptyValue(value)) unset.add(field)
    else set[field] = value
    record(field, label, show(kind, before), show(kind, value))
  }

  // ── pola proste ──
  for (const spec of SIMPLE_FIELDS) {
    if (!has(row, spec.column)) continue
    const cell = String(row[spec.column] ?? '').trim()
    let value: unknown =
      spec.kind === 'text' || spec.kind === 'longtext' ? cell || undefined
      : spec.kind === 'bool' ? parseBoolean(cell)
      : parseDecimal(cell)
    if (spec.kind === 'bool' && cell && value === undefined) {
      warn(`${spec.label}: „${cell}” to nie jest tak/nie — pole bez zmian`)
      continue
    }
    if ((spec.kind === 'money' || spec.kind === 'number' || spec.kind === 'int') && cell && value === undefined) {
      warn(`${spec.label}: „${cell}” to nie jest liczba — pole bez zmian`)
      continue
    }
    if (spec.kind === 'int' && typeof value === 'number') value = Math.max(0, Math.floor(value))
    if (isEmptyValue(value) && spec.keepIfEmpty) {
      if (!isUpdate && spec.field !== 'currency') warn(`brak wartości w kolumnie ${spec.column}`)
      continue
    }
    const before = spec.field === 'currency' ? (current?.currency ?? 'PLN') : current?.[spec.field]
    assign(spec.field, spec.label, value, spec.kind, before)
  }
  if (!isUpdate && !set.currency) set.currency = 'PLN'
  if (!isUpdate && !set.title) set.title = 'Untitled'

  // ── slug: tylko wyraźna wartość zmienia adres istniejącego produktu ──
  if (row.slug?.trim() || !isUpdate) {
    const slug = (partial.slug as { current?: string } | undefined)?.current
    if (slug && slug !== current?.slug) {
      set.slug = { _type: 'slug', current: slug }
      record('slug', 'Adres (slug)', current?.slug ?? '', slug)
    }
  }

  // ── opis: ten sam tekst co w sklepie = zostaje opis z formatowaniem ──
  if (has(row, 'description') || !isUpdate) {
    const text = String(row.description ?? '').trim()
    if (!isUpdate) {
      if (partial.description) set.description = partial.description
    } else if (!text) {
      if (current?.descriptionText?.trim()) {
        unset.add('description')
        record('description', 'Pełny opis', show('longtext', current.descriptionText), '')
      }
    } else if (plainText(text) !== plainText(current?.descriptionText)) {
      set.description = partial.description
      record('description', 'Pełny opis', show('longtext', current?.descriptionText), show('longtext', text))
    }
  }

  // ── tagi, wymiary ──
  if (has(row, 'tags')) assign('tags', 'Tagi', partial.tags, 'list', current?.tags)
  if (DIMENSION_COLUMNS.some((column) => has(row, column))) assign('dimensions', 'Wymiary', partial.dimensions, 'dims', current?.dimensions)

  // ── zakładki „Informacje o produkcie” (kolumny info_*) — w całości ──
  const withInfo = hasInfoColumns(row)
  if (withInfo) {
    const sections = infoSectionsFromCsvRow(row)
    // „Przed” = to, co sklep pokazuje dziś (zapisane zakładki albo stare pola
    // material/care jako „Skład” / „Dodatkowe informacje”) — jak w eksporcie.
    const shown = current ? productInfoSections({ infoSections: current.infoSections ?? undefined, material: current.material as string | undefined, care: current.care as string | undefined }) : []
    const beforeTitles = shown.map((s) => `${s.title}: ${plainText(s.body)}`)
    const afterTitles = sections.map((s) => `${s.title}: ${plainText(s.body)}`)
    if (JSON.stringify(beforeTitles) !== JSON.stringify(afterTitles)) {
      if (sections.length) set.infoSections = infoSectionsToSanity(sections)
      else unset.add('infoSections')
      // Stare pola zastąpione zakładkami (pierwszy zapis je przenosi).
      if (current?.material) unset.add('material')
      if (current?.care) unset.add('care')
      record('infoSections', 'Zakładki (info_…)', short(beforeTitles.join(' | ')), short(afterTitles.join(' | ')))
    }
  }

  // ── kategoria i podkategoria ──
  const resolveRef = async (column: 'category_slug' | 'type', field: 'category' | 'type', label: string, lookup: (slug: string) => Promise<string | null>, beforeId: unknown, beforeSlug: unknown) => {
    if (!has(row, column) && isUpdate) return
    const slug = String(row[column] ?? '').trim()
    if (!slug) {
      if (beforeId) {
        unset.add(field)
        record(field, label, String(beforeSlug ?? beforeId), '')
      }
      return
    }
    const id = await lookup(slug)
    if (!id) {
      warn(`${label}: nie ma „${slug}” w sklepie — pole bez zmian`)
      session.log(`${column === 'type' ? 'SUBCATEGORY' : 'CATEGORY'} NOT FOUND for slug: ${slug}`)
      return
    }
    if (id !== beforeId) {
      set[field] = ref(id)
      record(field, label, String(beforeSlug ?? ''), slug)
    }
  }
  await resolveRef('category_slug', 'category', 'Kategoria', (slug) => session.category(slug), current?.categoryId, current?.categorySlug)
  await resolveRef('type', 'type', 'Podkategoria', (slug) => session.subcategory(slug), current?.typeId, current?.typeSlug)

  // ── kolekcje: dokładnie te z pliku ──
  if (has(row, 'collections') || has(row, 'kolekcje')) {
    const names = parseCollectionNames(row)
    const { ids, created } = names.length ? await ensureCollectionsByName(names, { dryRun }) : { ids: [], created: [] }
    if (created.length) session.log(`${dryRun ? '[dry-run] Zostanie utworzony' : 'Utworzono'} szkic kolekcji: ${created.join(', ')}`)
    const before = (current?.collectionIds ?? []).filter((id): id is string => typeof id === 'string')
    if ([...before].sort().join('|') !== [...ids].sort().join('|')) {
      if (ids.length) set.collections = buildCollectionRefs(ids)
      else unset.add('collections')
      record('collections', 'Kolekcje', (current?.collectionNames ?? []).filter(Boolean).join(', '), names.join(', '))
    }
  }

  // ── parametry (filter_*) ──
  const filterCols = Object.keys(row).filter((column) => column.toLowerCase().startsWith('filter_'))
  const replacedFilterIds = new Set<string>()
  const newValueRefs: Ref[] = []
  const usedFilters: FilterDoc[] = []
  const valuesByKey = new Map<string, Array<{ id: string; label: string; slug: string }>>()
  const filterLabels = new Map<string, string>()
  for (const column of filterCols) {
    const rawKey = column.slice('filter_'.length)
    const values = splitList(row[column])
    const filter = (await session.filter(rawKey)) ?? (values.length ? await session.createFilter(rawKey) : null)
    if (!filter) {
      if (values.length) warn(`kolumna ${column}: nieprawidłowa nazwa filtra — pominięta`)
      continue
    }
    replacedFilterIds.add(filter._id)
    filterLabels.set(filter._id, filter.label || filter.key || rawKey)
    const resolved: Array<{ id: string; label: string; slug: string }> = []
    for (const value of values) {
      const found = await session.filterValue(filter, value)
      if (found && !resolved.some((r) => r.id === found.id)) {
        resolved.push(found)
        newValueRefs.push(ref(found.id))
      }
    }
    if (resolved.length) {
      usedFilters.push(filter)
      valuesByKey.set(normalizeToken(filter.key ?? rawKey), resolved)
    }
  }
  if (filterCols.length) {
    const kept = (current?.filterRefs ?? []).filter((fv) => fv?.id && !(fv.filter && replacedFilterIds.has(fv.filter)))
    const finalRefs = [...kept.map((fv) => ref(fv!.id!)), ...newValueRefs]
    const beforeIds = (current?.filterRefs ?? []).map((fv) => fv?.id).filter(Boolean).sort().join('|')
    const afterIds = finalRefs.map((r) => r._ref).sort().join('|')
    // Eksport wpisuje w filter_* także wartości WARIANTÓW. Produkt z Studio
    // bywa ich pozbawiony w parametrach — plik z eksportu nie jest wtedy zmianą.
    const variantValueIds = new Set((current?.variants ?? []).flatMap((variant) => variant.sig ?? []).filter((id): id is string => Boolean(id)))
    const withVariants = [...new Set([...(current?.filterRefs ?? []).map((fv) => fv?.id).filter((id): id is string => Boolean(id)), ...variantValueIds])].sort().join('|')
    const afterSet = [...new Set(finalRefs.map((r) => r._ref))].sort().join('|')
    if (beforeIds !== afterIds && afterSet !== withVariants) {
      if (finalRefs.length) set.filterValues = ensureArrayKeys(finalRefs)
      else unset.add('filterValues')
      for (const filterId of replacedFilterIds) {
        const before = (current?.filterRefs ?? []).filter((fv) => fv?.filter === filterId).map((fv) => fv!.value ?? '').sort((x, y) => x.localeCompare(y, 'pl')).join(', ')
        const after = (valuesByKey.get(normalizeToken([...usedFilters].find((f) => f._id === filterId)?.key ?? '')) ?? []).map((v) => v.label).sort((x, y) => x.localeCompare(y, 'pl')).join(', ')
        record(`filter:${filterId}`, `Parametr: ${filterLabels.get(filterId)}`, before, after)
      }
    }
  }

  // ── warianty ──
  const stockCell = has(row, STOCK_COLUMN) ? String(row[STOCK_COLUMN] ?? '').trim() : ''
  const priceCell = has(row, PRICE_COLUMN) ? String(row[PRICE_COLUMN] ?? '').trim() : ''
  const stockParse = parseVariantColumn(stockCell)
  const priceParse = parseVariantColumn(priceCell)
  for (const bad of [...stockParse.invalid, ...priceParse.invalid]) warn(`nieczytelny wpis „${bad}” w ${stockParse.invalid.includes(bad) ? STOCK_COLUMN : PRICE_COLUMN} (format: „Opcja: wartość=liczba”)`)
  const listsVariants = stockParse.entries.length > 0 || priceParse.entries.length > 0
  const existingVariants = current?.variants ?? []
  const productPrice = (set.price as number | undefined) ?? (unset.has('price') ? undefined : (current?.price as number | undefined))
  const stockColumnValue = has(row, 'stock') ? parseDecimal(row.stock) : undefined
  let variantDiff: VariantDiff | null = null
  const optionKeys = splitList(row.productOptions ?? '').map((key) => normalizeToken(key))
  const rebuild = has(row, 'productOptions') && (optionKeys.length > 0 || !listsVariants || !isUpdate)

  const describe = (stock: unknown, price: unknown) => ({
    stock: typeof stock === 'number' ? `${stock} szt.` : 'nieprowadzony',
    price: typeof price === 'number' ? money(price) : 'jak produkt',
  })

  if (rebuild) {
    // Struktura wariantów z pliku: iloczyn wartości opcji z productOptions.
    const optionRefs: Ref[] = []
    const options: Array<{ filter: FilterDoc; values: Array<{ id: string; label: string; slug: string }> }> = []
    for (const key of optionKeys) {
      const filter = await session.filter(key)
      if (!filter) {
        warn(`opcja „${key}” z productOptions nie istnieje — dodaj kolumnę filter_${key} z wartościami (filtr powstanie sam)`)
        continue
      }
      optionRefs.push(ref(filter._id))
      const values = valuesByKey.get(key)
      if (values?.length) options.push({ filter, values })
      else warn(`opcja „${filter.label ?? key}” jest w productOptions, ale kolumna filter_${key} jest pusta — wariantów z tej opcji nie będzie`)
    }
    const byTokens = new Map(existingVariants.map((variant) => [signature(variant.sig ?? []), variant]))
    const combos = options.length ? cartesian(options.map((option) => option.values.map((value) => ({ option, value })))) : []
    const labelOf = (combo: typeof combos[number]) => combo.map(({ option, value }) => `${option.filter.label || option.filter.key}: ${value.label}`).join(' · ')
    const matchable: MatchableVariant[] = combos.map((combo, index) => {
      const previous = byTokens.get(signature(combo.map(({ value }) => value.id)))
      return {
        sku: previous?.sku || generateSkuForVariant(sku, index, Object.fromEntries(combo.map(({ option, value }) => [option.filter.key ?? '', value.slug]))),
        pairs: combo.map(({ option, value }) => ({
          names: [option.filter.key ?? '', option.filter.label ?? ''],
          values: [value.label, value.slug],
        })),
      }
    })
    const stocks = assignVariantColumn(stockParse, matchable)
    const prices = assignVariantColumn(priceParse, matchable)
    for (const entry of stocks.unmatched) warn(`stan „${entry}” nie pasuje do żadnego wariantu z pliku`)
    for (const entry of prices.unmatched) warn(`cena „${entry}” nie pasuje do żadnego wariantu z pliku`)
    for (const entry of [...stocks.duplicated, ...prices.duplicated]) warn(`wariant podany dwa razy: „${entry}” — liczy się pierwszy wpis`)

    const values: VariantDiff['values'] = []
    const keptSigs = new Set<string>()
    const variants = combos.map((combo, index) => {
      const sig = signature(combo.map(({ value }) => value.id))
      const previous = byTokens.get(sig)
      if (previous) keptSigs.add(sig)
      let price: number | undefined
      if (priceParse.entries.length) price = prices.values[index] ?? undefined
      else if (previous && typeof previous.price === 'number' && previous.price !== current?.price) price = previous.price
      if (price !== undefined && productPrice !== undefined && price === productPrice) price = undefined
      let stock: number | undefined
      if (stockParse.entries.length) {
        const value = stocks.values[index]
        if (value === undefined) warn(`wariant „${labelOf(combo)}” nie ma stanu w ${STOCK_COLUMN} — stan nieprowadzony (zawsze dostępny)`)
        stock = typeof value === 'number' ? Math.floor(value) : undefined
      } else if (has(row, 'stock')) stock = typeof stockColumnValue === 'number' ? Math.max(0, Math.floor(stockColumnValue)) : undefined
      else if (typeof previous?.stock === 'number') stock = previous.stock
      const before = describe(previous?.stock, previous?.price !== current?.price ? previous?.price : undefined)
      const after = describe(stock, price)
      if (!previous) {
        values.push({ label: labelOf(combo), stockBefore: 'nowy', stockAfter: after.stock, priceBefore: 'nowy', priceAfter: after.price })
      } else if (before.stock !== after.stock || before.price !== after.price) {
        values.push({ label: labelOf(combo), stockBefore: before.stock, stockAfter: after.stock, priceBefore: before.price, priceAfter: after.price })
      }
      return {
        _key: previous?._key ?? nanoid(),
        sku: matchable[index].sku,
        ...(price !== undefined ? { price } : {}),
        ...(stock !== undefined ? { stock } : {}),
        optionValues: combo.map(({ option, value }) => ({
          _key: nanoid(),
          label: `${option.filter.label || option.filter.key}: ${value.label}`,
          name: ref(option.filter._id),
          value: ref(value.id),
        })),
        indexedOptions: combo.map(({ option, value }) => `${normalizeToken(option.filter.key ?? '')}:${value.slug}`),
      }
    })
    if (!stockParse.entries.length && has(row, 'stock') && variants.length > 1 && typeof stockColumnValue === 'number') {
      warn(`ten sam stan (${stockColumnValue} szt.) trafi do każdego z ${variants.length} wariantów — stany per wariant podaj w ${STOCK_COLUMN}`)
    }
    const added = combos.filter((combo) => !byTokens.has(signature(combo.map(({ value }) => value.id)))).map(labelOf)
    const removed = existingVariants.filter((variant) => !keptSigs.has(signature(variant.sig ?? []))).map((variant) => variant.label || variant.sku || 'wariant')
    const optionsChanged = (current?.optionIds ?? []).join('|') !== optionRefs.map((r) => r._ref).join('|')
    const changedValues = values.filter((value) => value.stockBefore !== 'nowy')
    const identical = isUpdate && !added.length && !removed.length && !changedValues.length && !optionsChanged
    if (variants.length) {
      if (!identical) {
        set.variants = variants
        set.productOptions = ensureArrayKeys(optionRefs)
      }
      // Produkt z wariantami: stan jest przy wariantach. Stan produktu byłby
      // „zapasowym” stanem każdego wariantu bez własnej liczby (lib/stock.ts) —
      // z sumą z kolumny `stock` każdy taki wariant pokazywałby całą sumę.
      if (stockParse.entries.length || has(row, 'stock')) {
        delete set.stock
        unset.delete('stock')
        const index = fields.findIndex((change) => change.field === 'stock')
        if (index >= 0) fields.splice(index, 1)
        if (typeof current?.stock === 'number') unset.add('stock')
      }
    } else {
      if (existingVariants.length) unset.add('variants')
      if (current?.optionIds?.length) unset.add('productOptions')
      if (!isUpdate && optionRefs.length) set.productOptions = ensureArrayKeys(optionRefs)
    }
    if (!identical && (added.length || removed.length || values.length || optionsChanged || !isUpdate)) {
      variantDiff = { added, removed, kept: keptSigs.size, total: variants.length, values }
    }
    if (removed.length && isUpdate) session.log(`SKU ${sku}: ${removed.length} wariantów nie ma już w CSV — ${dryRun ? 'zostaną usunięte' : 'usunięte z produktu'}`)
  } else if (isUpdate && existingVariants.length && listsVariants) {
    // Struktura bez zmian (brak productOptions albo puste + wymienione warianty):
    // aktualizujemy stany/ceny wymienionych wariantów.
    const matchable: MatchableVariant[] = existingVariants.map((variant) => ({ sku: variant.sku, pairs: pairsFromLabel(variant.label) }))
    const stocks = assignVariantColumn(stockParse, matchable)
    const prices = assignVariantColumn(priceParse, matchable)
    for (const entry of stocks.unmatched) warn(`stan „${entry}” nie pasuje do żadnego wariantu produktu`)
    for (const entry of prices.unmatched) warn(`cena „${entry}” nie pasuje do żadnego wariantu produktu`)
    const values: VariantDiff['values'] = []
    existingVariants.forEach((variant, index) => {
      const label = variant.label || variant.sku || 'wariant'
      let stock: number | null | undefined = variant.stock
      let price: number | null | undefined = variant.price !== current?.price ? variant.price : undefined
      if (stockParse.entries.length) {
        const value = stocks.values[index]
        if (value === undefined) warn(`wariant „${label}” nie ma stanu w ${STOCK_COLUMN} — stan bez zmian`)
        else stock = value === null ? undefined : Math.floor(value)
      }
      if (priceParse.entries.length) {
        const value = prices.values[index]
        price = value === null || value === undefined ? undefined : value
        if (price !== undefined && productPrice !== undefined && price === productPrice) price = undefined
      }
      const before = describe(variant.stock, variant.price !== current?.price ? variant.price : undefined)
      const after = describe(stock, price)
      if (before.stock === after.stock && before.price === after.price) return
      values.push({ label, stockBefore: before.stock, stockAfter: after.stock, priceBefore: before.price, priceAfter: after.price })
      const path = `variants[_key=="${variant._key}"]`
      if (typeof stock === 'number') set[`${path}.stock`] = stock
      else unset.add(`${path}.stock`)
      if (typeof price === 'number') set[`${path}.price`] = price
      else unset.add(`${path}.price`)
    })
    if (values.length) variantDiff = { added: [], removed: [], kept: existingVariants.length, total: existingVariants.length, values }
    if (has(row, 'productOptions') && !optionKeys.length) {
      session.log(`SKU ${sku}: puste productOptions, ale ${STOCK_COLUMN}/${PRICE_COLUMN} wymienia warianty — warianty zostają`)
    }
  } else if (listsVariants && !existingVariants.length && isUpdate) {
    warn(`${STOCK_COLUMN}/${PRICE_COLUMN} wymienia warianty, ale produkt ich nie ma i productOptions jest puste — wpisy pominięte`)
  }

  // Nowy filtr od razu w filtrach listingu podkategorii produktu.
  const subcategoryRef = ((set.type as Ref | undefined) ?? (current?.typeId ? ref(String(current.typeId)) : undefined))?._ref
  if (subcategoryRef) {
    for (const filter of usedFilters) await session.ensureSubcategoryFilter(subcategoryRef, filter)
  }

  const destructive = Boolean(variantDiff?.removed.length) || fields.some((change) => change.kind === 'cleared')
  const diff: ProductDiff = {
    fields,
    variants: variantDiff,
    warnings,
    destructive: isUpdate && destructive,
    unchanged: isUpdate && !fields.length && !variantDiff && !Object.keys(set).length && !unset.size,
  }
  const title = String(set.title ?? current?.title ?? row.title ?? '')
  const slug = (set.slug as { current?: string } | undefined)?.current ?? current?.slug
  const base: ImportRowResult = {
    row: rowNumber,
    ok: true,
    sku,
    title,
    slug,
    action: isUpdate ? 'update' : 'create',
    id: current?._id.replace(DRAFT, ''),
    diff,
  }

  if (dryRun) {
    session.log(`[dry-run] ${rowNumber}: SKU ${sku} → ${isUpdate ? (diff.unchanged ? 'BEZ ZMIAN' : 'UPDATE') : 'CREATE'} (bez zapisu)`)
    return base
  }

  if (isUpdate) {
    if (diff.unchanged) {
      session.log(`Unchanged ${rowNumber}: ${base.id} (SKU: ${sku})`)
      return base
    }
    const variantKeys = ((set.variants as Array<{ _key: string }> | undefined) ?? (unset.has('variants') ? [] : existingVariants)).map((v) => v._key)
    const tx = raw.transaction()
    for (const version of versions) {
      const payload: Record<string, unknown> = { ...set }
      const removeFields = new Set(unset)
      // Zdjęcia zostają; znikają tylko przypisania do usuniętych wariantów.
      if (set.variants || unset.has('variants')) {
        for (const image of version.images ?? []) {
          if (!image.variantKeys?.length) continue
          const pruned = pruneVariantKeys(image.variantKeys, variantKeys)
          if (pruned.length === image.variantKeys.length) continue
          if (!pruned.length) {
            // Zdjęcie tylko usuniętych wariantów NIE staje się wspólne (pokazałoby
            // się przy każdym wariancie) — zostaje ukryte do decyzji w panelu.
            session.log(`SKU ${sku}: zdjęcie ${image._key} należało tylko do usuniętych wariantów — ukryte (przypisz albo usuń je w panelu)`)
            continue
          }
          payload[`images[_key=="${image._key}"].variantKeys`] = pruned
        }
      }
      // Ścieżki wariantów (stan/cena) tylko w wersji, która ma ten wariant.
      for (const key of Object.keys(payload)) {
        const match = /^variants\[_key=="([^"]+)"\]/.exec(key)
        if (match && !(version.variants ?? []).some((v) => v._key === match[1])) delete payload[key]
      }
      for (const key of [...removeFields]) {
        const match = /^variants\[_key=="([^"]+)"\]/.exec(key)
        if (match && !(version.variants ?? []).some((v) => v._key === match[1])) removeFields.delete(key)
      }
      tx.patch(version._id, (patch) => {
        let next = Object.keys(payload).length ? patch.set(payload) : patch
        if (removeFields.size) next = next.unset([...removeFields])
        return next
      })
    }
    await tx.commit()
    session.log(`Updated ${rowNumber}: ${base.id} (SKU: ${sku})`)
    return base
  }

  // Nowy produkt powstaje jako SZKIC (`drafts.<id>`) — sklep go nie widzi, dopóki
  // admin nie opublikuje go w Katalogu (także hurtowo: zaznacz → „Opublikuj”).
  const id = randomUUID()
  const doc: Record<string, unknown> & { _id: string; _type: string } = { ...set, sku, _id: `${DRAFT}${id}`, _type: 'product' }
  if (!doc.slug && partial.slug) doc.slug = partial.slug
  if (!doc.description && partial.description) doc.description = partial.description
  for (const key of Object.keys(doc)) if (key !== '_id' && key !== '_type' && isEmptyValue(doc[key])) delete doc[key]
  await raw.create(doc)
  session.log(`Created ${rowNumber}: ${id} (SKU: ${sku}, szkic)`)
  return { ...base, id }
}
