/*
 * Zakładki „Informacje o produkcie” na karcie produktu (pod „Opis”): dowolny
 * tytuł + treść dla KAŻDEGO produktu osobno, np. „Skład”, „Dodatkowe
 * informacje”, „Pielęgnacja”. Zastępują sztywną zakładkę „Materiał”.
 *
 * Czyste funkcje bez importów serwerowych — używają ich: karta produktu,
 * okno produktu w panelu, zapis w Sanity (lib/admin/catalog.ts), import
 * i eksport CSV (kolumny `info_<Tytuł>`).
 *
 * Dane w Sanity: `product.infoSections[] = { _key, title, body }`.
 * Stare pola `material` / `care` sklep pokazuje tylko u produktów, które nie
 * mają jeszcze zakładek — jako „Skład” i „Dodatkowe informacje”.
 */

export type ProductInfoSection = { key: string; title: string; body: string }

export const INFO_MAX_SECTIONS = 10
export const INFO_TITLE_MAX = 80
export const INFO_BODY_MAX = 3000

/** Podpowiedzi tytułów w panelu (można wpisać dowolny). */
export const INFO_TITLE_SUGGESTIONS = ['Skład', 'Dodatkowe informacje', 'Pielęgnacja', 'Wymiary i rozmiar', 'Dla kogo'] as const

/** Domyślne zakładki nowego produktu w panelu (puste — bez treści się nie pokazują). */
export const DEFAULT_INFO_TITLES = ['Skład', 'Dodatkowe informacje'] as const

/** Kolumny CSV z zakładkami: `info_Skład`, `info_Dodatkowe informacje`… */
export const INFO_CSV_PREFIX = 'info_'

const KEY_RE = /^[A-Za-z0-9_-]{1,40}$/

function randomKey(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)
}

const cleanTitle = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, INFO_TITLE_MAX)

/** Treść: zachowuje akapity i listy (nowe linie), przycina spacje na końcach linii. */
const cleanBody = (value: unknown) =>
  String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, INFO_BODY_MAX)

/**
 * Normalizacja danych z formularza, Sanity albo CSV: bez pustych zakładek
 * (brak tytułu albo treści), bez duplikatów tytułów (wygrywa pierwszy),
 * unikalne klucze, najwyżej INFO_MAX_SECTIONS.
 */
export function normalizeInfoSections(input: unknown): ProductInfoSection[] {
  if (!Array.isArray(input)) return []
  const seenKeys = new Set<string>()
  const seenTitles = new Set<string>()
  const result: ProductInfoSection[] = []
  for (const item of input) {
    if (result.length >= INFO_MAX_SECTIONS) break
    const entry = (item ?? {}) as Record<string, unknown>
    const title = cleanTitle(entry.title)
    const body = cleanBody(entry.body)
    if (!title || !body) continue
    const titleKey = title.toLocaleLowerCase('pl')
    if (seenTitles.has(titleKey)) continue
    seenTitles.add(titleKey)
    let key = String(entry.key ?? entry._key ?? '')
    if (!KEY_RE.test(key) || seenKeys.has(key)) key = randomKey()
    seenKeys.add(key)
    result.push({ key, title, body })
  }
  return result
}

type InfoSource = {
  infoSections?: unknown
  material?: string | null
  care?: string | null
}

/** Stare pola jako zakładki (produkty sprzed zakładek). */
export function legacyInfoSections(product: InfoSource): ProductInfoSection[] {
  return normalizeInfoSections([
    { key: 'legacy-material', title: 'Skład', body: product.material },
    { key: 'legacy-care', title: 'Dodatkowe informacje', body: product.care },
  ])
}

/**
 * Zakładki do pokazania na karcie produktu. Produkt z zapisanymi zakładkami
 * (nawet pustą listą — admin wszystko usunął) nie wraca do starych pól.
 */
export function productInfoSections(product: InfoSource): ProductInfoSection[] {
  if (Array.isArray(product.infoSections)) return normalizeInfoSections(product.infoSections)
  return legacyInfoSections(product)
}

/** Stan początkowy edytora w panelu: zapisane zakładki → stare pola → puste domyślne. */
export function infoSectionsForEditor(product: InfoSource | null): Array<{ key: string; title: string; body: string }> {
  if (product && Array.isArray(product.infoSections)) {
    const saved = (product.infoSections as Array<Record<string, unknown>>).map((entry) => ({
      key: String(entry?._key ?? entry?.key ?? randomKey()),
      title: String(entry?.title ?? ''),
      body: String(entry?.body ?? ''),
    }))
    if (saved.length) return saved
  }
  const legacy = product ? legacyInfoSections(product) : []
  const titles = new Set(legacy.map((section) => section.title))
  return [
    ...legacy,
    ...DEFAULT_INFO_TITLES.filter((title) => !titles.has(title)).map((title) => ({ key: randomKey(), title, body: '' })),
  ]
}

/** Format zapisu w Sanity (tablica obiektów z `_key`). */
export function infoSectionsToSanity(sections: ProductInfoSection[]) {
  return sections.map((section) => ({
    _key: section.key,
    _type: 'productInfoSection',
    title: section.title,
    body: section.body,
  }))
}

/** Czy wiersz CSV ma jakąkolwiek kolumnę zakładek (także pustą). */
export function hasInfoColumns(row: Record<string, unknown>): boolean {
  return Object.keys(row).some((column) => column.toLowerCase().startsWith(INFO_CSV_PREFIX))
}

/** Kolumny `info_<Tytuł>` wiersza CSV → zakładki (w kolejności kolumn). */
export function infoSectionsFromCsvRow(row: Record<string, string | undefined>): ProductInfoSection[] {
  return normalizeInfoSections(
    Object.keys(row)
      .filter((column) => column.toLowerCase().startsWith(INFO_CSV_PREFIX))
      .map((column) => ({
        title: column.slice(INFO_CSV_PREFIX.length).replace(/_/g, ' '),
        // W CSV nowa linia w komórce bywa zapisana jako „\n” — zamieniamy na prawdziwą.
        body: String(row[column] ?? '').replace(/\\n/g, '\n'),
      })),
  )
}
