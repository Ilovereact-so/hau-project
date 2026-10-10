import 'server-only'
import { sanityClient } from '@/sanity/sanityClient.server'
import { searchEntries, type SearchIndexEntry } from '@/lib/search'

/*
 * Indeks wyszukiwarki: lekka lista wszystkich opublikowanych produktów
 * z tekstami do przeszukania (nazwa, marka, kategorie, tagi, SKU, opisy).
 * Trzymany w pamięci procesu 5 minut (+ cache Next tagowany `sanity`), więc
 * podpowiedzi w trakcie pisania nie odpytują Sanity przy każdym znaku.
 * Pełny opis przycinamy do 4000 znaków — wystarcza do dopasowania słów,
 * a nie rozdmuchuje pamięci przy dużym katalogu.
 */

const TTL_MS = 5 * 60_000
const BODY_MAX = 4000

let cache: { at: number; entries: SearchIndexEntry[] } | null = null
let inflight: Promise<SearchIndexEntry[]> | null = null

async function loadIndex(): Promise<SearchIndexEntry[]> {
  const rows = await sanityClient.fetch<SearchIndexEntry[]>(
    `*[_type == "product" && defined(slug.current) && defined(title)]{
      _id, title, subtitle, brand, sku, tags,
      "category": category->title,
      "subcategory": type->title,
      shortDescription,
      "body": pt::text(description)
    }`,
    {},
    { next: { revalidate: 300, tags: ['sanity'] } },
  )
  return (rows ?? []).map((row) => ({ ...row, body: row.body ? row.body.slice(0, BODY_MAX) : null }))
}

export async function getSearchIndex(): Promise<SearchIndexEntry[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.entries
  if (inflight) return inflight
  inflight = loadIndex()
    .then((entries) => {
      cache = { at: Date.now(), entries }
      return entries
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Identyfikatory produktów pasujących do frazy, od najlepszego. */
export async function searchProductIds(query: string, limit = 200): Promise<string[]> {
  try {
    const index = await getSearchIndex()
    return searchEntries(index, query, limit).map((hit) => hit.id)
  } catch (error) {
    console.error('[search] index failed', error)
    return []
  }
}
