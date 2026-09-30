/*
 * Układ strony głównej — typy, wartości domyślne i walidacja (czyste, bez
 * importów serwerowych: używa ich panel w przeglądarce i serwer).
 *
 * Dokument Sanity `homeLayout` (jeden, `_id: "homeLayout"`) trzyma listę
 * sekcji w kolejności wyświetlania. Sekcja „products” to karuzela produktów,
 * której zawartość wylicza serwer (lib/homeLayout.server.ts) z reguły:
 * ŹRÓDŁO (cały sklep / kolekcja / kategoria / subkategoria / ręczna lista)
 * + KOLEJNOŚĆ (najczęściej zamawiane, nowości, promowane…) + FILTRY
 * + przypięte na początek / wykluczone produkty + limit.
 * Pozostałe sekcje to stałe moduły strony (pasek zalet, subkategorie,
 * poradniki, „O nas”) — można je przestawiać i ukrywać.
 */

export const HOME_LAYOUT_ID = 'homeLayout'

export const HOME_STATIC_KINDS = ['valueBar', 'subcategories', 'guides', 'about'] as const
export type HomeStaticKind = (typeof HOME_STATIC_KINDS)[number]

export const HOME_STATIC_LABELS: Record<HomeStaticKind, { title: string; hint: string }> = {
  valueBar: { title: 'Pasek zalet sklepu', hint: 'Dostawa, zwroty, płatności — ikony w jednym rzędzie.' },
  subcategories: { title: 'Kafelki subkategorii', hint: 'Siatka subkategorii ze zdjęciami.' },
  guides: { title: 'Poradniki', hint: 'Najnowsze wpisy z /poradniki.' },
  about: { title: 'O nas', hint: 'Sekcja „O nas” na dole strony.' },
}

export const PRODUCT_SOURCES = ['all', 'collection', 'category', 'subcategory', 'manual'] as const
export type ProductSource = (typeof PRODUCT_SOURCES)[number]

export const PRODUCT_SOURCE_LABELS: Record<ProductSource, string> = {
  all: 'Cały sklep',
  collection: 'Kolekcja',
  category: 'Kategoria',
  subcategory: 'Subkategoria',
  manual: 'Wybrane ręcznie',
}

export const HOME_ORDERS = [
  'popular',
  'featured',
  'newest',
  'rating',
  'discount',
  'price-asc',
  'price-desc',
  'manual',
] as const
export type HomeOrder = (typeof HOME_ORDERS)[number]

export const HOME_ORDER_LABELS: Record<HomeOrder, { title: string; hint: string }> = {
  popular: { title: 'Najczęściej zamawiane', hint: 'Sprzedane sztuki z ostatnich 90 dni (promowane na początku).' },
  featured: { title: 'Promowane i bestsellery', hint: 'Najpierw „Promowany”, potem „Bestseller”, dalej wg sprzedaży.' },
  newest: { title: 'Nowości', hint: 'Ostatnio dodane do sklepu.' },
  rating: { title: 'Najlepiej oceniane', hint: 'Najwyższa średnia opinii.' },
  discount: { title: 'Największa obniżka', hint: 'Procent obniżki z rejestru cen.' },
  'price-asc': { title: 'Najtańsze', hint: 'Cena rosnąco.' },
  'price-desc': { title: 'Najdroższe', hint: 'Cena malejąco.' },
  manual: { title: 'Kolejność ręczna', hint: 'Tak, jak ułożysz produkty na liście.' },
}

export type HomeRef = { id: string; title?: string; slug?: string }

export type HomeProductsSection = {
  key: string
  kind: 'products'
  enabled: boolean
  title: string
  subtitle?: string
  source: ProductSource
  /** kolekcja / kategoria / subkategoria — dla źródeł innych niż „all” i „manual” */
  ref?: HomeRef | null
  /** produkty źródła „manual” (w kolejności) */
  productIds: string[]
  /** zawsze na początku karuzeli (niezależnie od źródła i filtrów) */
  pinnedIds: string[]
  /** nigdy nie pokazuj */
  excludedIds: string[]
  order: HomeOrder
  onlyFeatured: boolean
  onlyBestseller: boolean
  onlyInStock: boolean
  onlyDiscounted: boolean
  limit: number
  /** link „Zobacz wszystkie” do strony kolekcji / subkategorii */
  showMoreLink: boolean
}

export type HomeStaticSection = { key: string; kind: HomeStaticKind; enabled: boolean }
export type HomeSection = HomeProductsSection | HomeStaticSection
export type HomeLayoutData = { sections: HomeSection[]; updatedAt?: string | null }

export const LIMIT_MIN = 4
export const LIMIT_MAX = 24
export const MAX_SECTIONS = 20
export const MAX_IDS = 60

let keySeq = 0
export function newSectionKey(): string {
  keySeq += 1
  return `s${Date.now().toString(36)}${keySeq.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function newProductsSection(patch: Partial<HomeProductsSection> = {}): HomeProductsSection {
  return {
    key: newSectionKey(),
    kind: 'products',
    enabled: true,
    title: 'Nowa karuzela',
    subtitle: '',
    source: 'all',
    ref: null,
    productIds: [],
    pinnedIds: [],
    excludedIds: [],
    order: 'popular',
    onlyFeatured: false,
    onlyBestseller: false,
    onlyInStock: true,
    onlyDiscounted: false,
    limit: 12,
    showMoreLink: true,
    ...patch,
  }
}

/**
 * Układ, gdy w Sanity nie ma jeszcze dokumentu — odtwarza dotychczasową
 * stronę (te same moduły w tej samej kolejności), ale każda karuzela ma
 * sensowne, RÓŻNE źródło zamiast trzech kopii tej samej kategorii.
 */
export function defaultHomeLayout(): HomeLayoutData {
  return {
    sections: [
      { ...newProductsSection({ title: 'Najczęściej wybierane', order: 'popular' }), key: 'default-popular' },
      { key: 'default-valuebar', kind: 'valueBar', enabled: true },
      { ...newProductsSection({ title: 'Nowości w sklepie', order: 'newest' }), key: 'default-newest' },
      { key: 'default-subcategories', kind: 'subcategories', enabled: true },
      { ...newProductsSection({ title: 'Polecamy', order: 'featured' }), key: 'default-featured' },
      { key: 'default-guides', kind: 'guides', enabled: true },
      { key: 'default-about', kind: 'about', enabled: true },
    ],
    updatedAt: null,
  }
}

const str = (value: unknown, max: number) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback)
const ID_RE = /^[A-Za-z0-9._-]{1,128}$/
const ids = (value: unknown) =>
  [...new Set((Array.isArray(value) ? value : []).map((id) => String(id).replace(/^drafts\./, '')).filter((id) => ID_RE.test(id)))].slice(0, MAX_IDS)
const oneOf = <T extends string>(value: unknown, list: readonly T[], fallback: T): T =>
  (list as readonly string[]).includes(String(value)) ? (value as T) : fallback

/**
 * Normalizacja danych z Sanity albo z formularza panelu: nieznane pola
 * i wartości nie przechodzą, brakujące dostają domyślne. Sekcja bez sensu
 * (np. kolekcja bez wybranej kolekcji) zostaje, ale serwer pokaże ją pustą —
 * panel ostrzega o tym przy zapisie (`sectionProblems`).
 */
export function normalizeHomeLayout(input: unknown): HomeLayoutData {
  const raw = (input ?? {}) as { sections?: unknown; updatedAt?: unknown; _updatedAt?: unknown }
  if (!Array.isArray(raw.sections)) return defaultHomeLayout()
  const seen = new Set<string>()
  const sections: HomeSection[] = []
  for (const item of raw.sections.slice(0, MAX_SECTIONS)) {
    const s = (item ?? {}) as Record<string, unknown>
    let key = str(s.key ?? s._key, 64) || newSectionKey()
    if (seen.has(key)) key = newSectionKey()
    seen.add(key)
    const enabled = bool(s.enabled, true)
    if (s.kind === 'products') {
      const refRaw = (s.ref ?? null) as Record<string, unknown> | null
      const refId = refRaw ? str(refRaw.id, 128) : ''
      const source = oneOf(s.source, PRODUCT_SOURCES, 'all')
      sections.push({
        key,
        kind: 'products',
        enabled,
        title: str(s.title, 80) || 'Produkty',
        subtitle: str(s.subtitle, 160),
        source,
        ref: refRaw && (refId || refRaw.slug) && source !== 'all' && source !== 'manual'
          ? { id: ID_RE.test(refId) ? refId : '', title: str(refRaw.title, 120), slug: str(refRaw.slug, 120) }
          : null,
        productIds: ids(s.productIds),
        pinnedIds: ids(s.pinnedIds),
        excludedIds: ids(s.excludedIds),
        order: oneOf(s.order, HOME_ORDERS, 'popular'),
        onlyFeatured: bool(s.onlyFeatured, false),
        onlyBestseller: bool(s.onlyBestseller, false),
        onlyInStock: bool(s.onlyInStock, true),
        onlyDiscounted: bool(s.onlyDiscounted, false),
        limit: Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, Math.round(Number(s.limit) || 12))),
        showMoreLink: bool(s.showMoreLink, true),
      })
    } else if ((HOME_STATIC_KINDS as readonly string[]).includes(String(s.kind))) {
      // Każdy stały moduł najwyżej raz.
      if (sections.some((other) => other.kind === s.kind)) continue
      sections.push({ key, kind: s.kind as HomeStaticKind, enabled })
    }
  }
  const updated = raw.updatedAt ?? raw._updatedAt
  return { sections, updatedAt: typeof updated === 'string' ? updated : null }
}

/** Ostrzeżenia dla panelu (nie blokują zapisu). */
export function sectionProblems(section: HomeSection): string[] {
  if (section.kind !== 'products') return []
  const problems: string[] = []
  if (['collection', 'category', 'subcategory'].includes(section.source) && !section.ref?.id && !section.ref?.slug) {
    problems.push(`Wybierz ${PRODUCT_SOURCE_LABELS[section.source].toLowerCase()} — bez niej karuzela będzie pusta.`)
  }
  if (section.source === 'manual' && !section.productIds.length && !section.pinnedIds.length) {
    problems.push('Dodaj produkty do listy — karuzela „Wybrane ręcznie” jest pusta.')
  }
  if (section.order === 'manual' && section.source !== 'manual') {
    problems.push('Kolejność ręczna działa tylko dla źródła „Wybrane ręcznie” — pozostałe użyją „Najczęściej zamawiane”.')
  }
  if (!section.title.trim()) problems.push('Karuzela nie ma tytułu.')
  return problems
}

/** Opis reguły jednym zdaniem (lista sekcji w panelu). */
export function describeSection(section: HomeProductsSection): string {
  const source =
    section.source === 'manual'
      ? `${section.productIds.length} wybranych produktów`
      : section.source === 'all'
        ? 'cały sklep'
        : `${PRODUCT_SOURCE_LABELS[section.source].toLowerCase()}: ${section.ref?.title || section.ref?.slug || '—'}`
  const filters = [
    section.onlyFeatured && 'tylko promowane',
    section.onlyBestseller && 'tylko bestsellery',
    section.onlyDiscounted && 'tylko w promocji',
    section.onlyInStock && 'dostępne',
  ].filter(Boolean)
  return [source, HOME_ORDER_LABELS[section.order].title.toLowerCase(), ...filters, `do ${section.limit} szt.`].join(' · ')
}
