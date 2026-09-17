/*
 * Sortowanie list produktów (subkategoria, wyniki wyszukiwania, kolekcja).
 *
 * Czysta logika — bez importów serwerowych, więc korzystają z niej i strony
 * serwerowe, i komponent wyboru sortowania w przeglądarce.
 *
 * Sygnały do sortowania pochodzą z różnych miejsc (sprzedaż z MySQL, oceny
 * z opinii, obniżki z rejestru cen), dlatego wchodzą tu jako gotowe mapy —
 * ten moduł tylko porządkuje listę. Kolejność jest zawsze deterministyczna:
 * po wartości głównej rozstrzyga nazwa, a na końcu `_id`, żeby ta sama lista
 * nie „skakała” między odświeżeniami.
 */

import { effectivePrice, tilePriceKey } from '@/lib/omnibus'

export const PRODUCT_SORTS = [
  'popular',
  'price-asc',
  'price-desc',
  'discount',
  'rating',
  'newest',
  'title',
] as const

export type ProductSort = (typeof PRODUCT_SORTS)[number]

export const DEFAULT_PRODUCT_SORT: ProductSort = 'popular'

export const PRODUCT_SORT_LABELS: Record<ProductSort, string> = {
  popular: 'Popularne',
  'price-asc': 'Najtańsze',
  'price-desc': 'Najdroższe',
  discount: 'Największa obniżka',
  rating: 'Najlepiej oceniane',
  newest: 'Nowości',
  title: 'Nazwa A–Z',
}

/** Krótszy opis pod etykietą w menu wyboru. */
export const PRODUCT_SORT_HINTS: Record<ProductSort, string> = {
  popular: 'Najczęściej kupowane w ostatnich 90 dniach',
  'price-asc': 'Cena rosnąco',
  'price-desc': 'Cena malejąco',
  discount: 'Największy procent obniżki',
  rating: 'Najwyższa średnia ocen',
  newest: 'Ostatnio dodane do sklepu',
  title: 'Alfabetycznie',
}

export function isProductSort(value: unknown): value is ProductSort {
  return typeof value === 'string' && (PRODUCT_SORTS as readonly string[]).includes(value)
}

/** Wartość `?sort=` z adresu → bezpieczne sortowanie (nieznane = domyślne). */
export function parseProductSort(
  value: string | string[] | undefined | null,
  fallback: ProductSort = DEFAULT_PRODUCT_SORT,
): ProductSort {
  const raw = Array.isArray(value) ? value[0] : value
  return isProductSort(raw) ? raw : fallback
}

export type SortableProduct = {
  _id: string
  title?: string | null
  _createdAt?: string | null
  price?: number | null
  variants?: Array<{ _key?: string | null; price?: number | null } | null> | null
  /** Wariant wybrany przez filtry — to jego cenę widzi klient na kafelku. */
  defaultVariant?: string
}

export type SortSignals = {
  /** Liczba sprzedanych sztuk (albo inna miara popularności). */
  popularity?: Map<string, number>
  /** Średnia ocen i liczba opinii. */
  rating?: Map<string, { average: number; count: number }>
  /** Procent obniżki z rejestru cen. */
  discount?: Map<string, number>
}

/** Które dane trzeba pobrać dla danego sortowania (reszty nie ruszamy). */
export function signalsNeeded(sort: ProductSort): Array<keyof SortSignals> {
  switch (sort) {
    case 'popular':
      // Bez sprzedaży o kolejności decyduje liczba opinii (patrz sortProducts).
      return ['popularity', 'rating']
    case 'rating':
      return ['rating']
    case 'discount':
      return ['discount']
    default:
      return []
  }
}

/** Cena widoczna na kafelku: wariant z filtrów → pierwszy wariant → produkt. */
export function listingPrice(product: SortableProduct): number | null {
  return effectivePrice(product, product.defaultVariant || tilePriceKey(product))
}

const collator = new Intl.Collator('pl', { sensitivity: 'base', numeric: true })

const byTitle = (a: SortableProduct, b: SortableProduct) =>
  collator.compare(a.title ?? '', b.title ?? '') || (a._id < b._id ? -1 : a._id > b._id ? 1 : 0)

const createdAt = (product: SortableProduct) => {
  const time = product._createdAt ? Date.parse(product._createdAt) : Number.NaN
  return Number.isFinite(time) ? time : 0
}

/**
 * Sortuje kopię listy. Produkty bez danej wartości (brak ceny, brak opinii,
 * brak obniżki) lądują na końcu — nigdy nie wypadają z listy.
 */
export function sortProducts<T extends SortableProduct>(
  products: T[],
  sort: ProductSort,
  signals: SortSignals = {},
): T[] {
  const list = [...products]
  const popularity = (id: string) => signals.popularity?.get(id) ?? 0
  const rating = (id: string) => signals.rating?.get(id) ?? { average: 0, count: 0 }
  const discount = (id: string) => signals.discount?.get(id) ?? 0

  switch (sort) {
    case 'price-asc':
    case 'price-desc': {
      const direction = sort === 'price-asc' ? 1 : -1
      return list.sort((a, b) => {
        const priceA = listingPrice(a)
        const priceB = listingPrice(b)
        if (priceA === null || priceB === null) {
          if (priceA === priceB) return byTitle(a, b)
          return priceA === null ? 1 : -1
        }
        return (priceA - priceB) * direction || byTitle(a, b)
      })
    }

    case 'discount':
      return list.sort((a, b) => {
        const diff = discount(b._id) - discount(a._id)
        if (diff) return diff
        return popularity(b._id) - popularity(a._id) || byTitle(a, b)
      })

    case 'rating':
      return list.sort((a, b) => {
        const ratingA = rating(a._id)
        const ratingB = rating(b._id)
        // Produkty bez opinii na koniec — średnia 0 nie może wyprzedzić 3,5.
        if (!ratingA.count || !ratingB.count) {
          if (ratingA.count === ratingB.count) return byTitle(a, b)
          return ratingA.count ? -1 : 1
        }
        return ratingB.average - ratingA.average || ratingB.count - ratingA.count || byTitle(a, b)
      })

    case 'newest':
      return list.sort((a, b) => createdAt(b) - createdAt(a) || byTitle(a, b))

    case 'title':
      return list.sort(byTitle)

    case 'popular':
    default:
      return list.sort((a, b) => {
        const diff = popularity(b._id) - popularity(a._id)
        if (diff) return diff
        // Bez sprzedaży decyduje liczba opinii, a potem świeżość — dzięki temu
        // nowy sklep (zero zamówień) nie pokazuje listy w losowej kolejności.
        const reviewsDiff = rating(b._id).count - rating(a._id).count
        if (reviewsDiff) return reviewsDiff
        return createdAt(b) - createdAt(a) || byTitle(a, b)
      })
  }
}
