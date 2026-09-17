/*
 * Wspólne klocki kolekcji — bez importów serwerowych, używane przez:
 *  - panel Studio (components/CollectionProductsInput),
 *  - panel admina i import CSV (lib/admin/collections.ts).
 *
 * Przynależność produktu do kolekcji = słaba referencja w `product.collections`.
 */

import type { PatchOperations } from '@sanity/client'

export const COLLECTION_ID_PREFIX = 'collection-'
const DRAFT_PREFIX = 'drafts.'

export const baseDocId = (id: string) => (id.startsWith(DRAFT_PREFIX) ? id.slice(DRAFT_PREFIX.length) : id)

/** „Jesień / Zima 2026” → „jesien-zima-2026” (spójnie ze slugify panelu admina). */
export function slugifyCollection(value: string): string {
  return value
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
}

/**
 * Deterministyczne `_id` kolekcji tworzonej automatycznie. Dwa produkty
 * z tą samą nową kolekcją (np. w jednym imporcie) trafiają w ten sam
 * dokument zamiast tworzyć duplikaty.
 */
export function collectionIdForSlug(slug: string): string {
  return `${COLLECTION_ID_PREFIX}${slug}`
}

let keySeq = 0
export function arrayKey(): string {
  keySeq = (keySeq + 1) % 1_000_000
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}${keySeq.toString(36)}`
}

export function collectionRef(collectionId: string) {
  return { _type: 'reference' as const, _ref: baseDocId(collectionId), _weak: true as const, _key: arrayKey() }
}

/** Filtr ścieżki dla elementów tablicy wskazujących kolekcję (id z whitelisty znaków). */
function refSelector(collectionId: string): string {
  const id = baseDocId(collectionId)
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(id)) throw new Error('Nieprawidłowy identyfikator kolekcji.')
  return `collections[_ref == "${id}"]`
}

export type CollectionPatchMutation = { patch: PatchOperations & { id: string } }

/** Dopisuje kolekcję do podanych wersji produktu (idempotentnie — bez duplikatów). */
export function addCollectionRefMutations(productVersionIds: string[], collectionId: string): CollectionPatchMutation[] {
  return productVersionIds.flatMap((id) => [
    { patch: { id, setIfMissing: { collections: [] }, unset: [refSelector(collectionId)] } },
    { patch: { id, insert: { after: 'collections[-1]', items: [collectionRef(collectionId)] } } },
  ])
}

/** Usuwa kolekcję z podanych wersji produktu. */
export function removeCollectionRefMutations(productVersionIds: string[], collectionId: string): CollectionPatchMutation[] {
  return productVersionIds.map((id) => ({ patch: { id, unset: [refSelector(collectionId)] } }))
}

export type CollectionProductRow = {
  _id: string
  title?: string | null
  sku?: string | null
  imageUrl?: string | null
}

const ROW_PROJECTION = `{ _id, title, sku, "imageUrl": images[0].asset->url }`

/** Produkty (obie wersje) wskazujące kolekcję `$id`. */
export const COLLECTION_PRODUCTS_QUERY = `*[_type == "product" && $id in collections[]._ref && !(_id in path("versions.**"))] ${ROW_PROJECTION}`

/** Wyszukiwarka produktów po nazwie/SKU (`$q` w formacie `*fraza*`). */
export const COLLECTION_PRODUCT_SEARCH_QUERY = `*[_type == "product" && !(_id in path("versions.**")) && (title match $q || sku match $q)] | order(lower(title) asc) [0...30] ${ROW_PROJECTION}`

export const COLLECTION_SORTS = ['newest', 'price-asc', 'price-desc', 'title'] as const
export type CollectionSort = (typeof COLLECTION_SORTS)[number]

export function isCollectionSort(value: unknown): value is CollectionSort {
  return typeof value === 'string' && (COLLECTION_SORTS as readonly string[]).includes(value)
}

export const COLLECTION_SORT_LABELS: Record<CollectionSort, string> = {
  newest: 'Najnowsze',
  'price-asc': 'Cena: od najniższej',
  'price-desc': 'Cena: od najwyższej',
  title: 'Nazwa A–Z',
}

/** Fragment GROQ `order(...)` dla sortowania kolekcji (tylko z whitelisty). */
export function collectionOrderClause(sort: CollectionSort): string {
  switch (sort) {
    case 'price-asc':
      return 'order(price asc, lower(title) asc)'
    case 'price-desc':
      return 'order(price desc, lower(title) asc)'
    case 'title':
      return 'order(lower(title) asc)'
    default:
      return 'order(_createdAt desc)'
  }
}
