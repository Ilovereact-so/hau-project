import 'server-only'
import { sanityFetch } from '@/sanity/lib/live'
import { sanityClient } from '@/sanity/sanityClient.server'
import type { GetSlugProduct } from 'sanity.types'
import { getDiscounts, getPopularityScores, getRatings } from '@/lib/productListing'
import { promotionRank, sortProducts, type ProductSort, type SortSignals } from '@/lib/productSort'
import {
  HOME_LAYOUT_ID,
  normalizeHomeLayout,
  type HomeAbout,
  type HomeLayoutData,
  type HomeProductsSection,
  type HomeSection,
} from '@/lib/homeLayout'

/*
 * Strona główna: odczyt układu i wyliczanie zawartości karuzel (server-only).
 *
 * Karuzele liczy SERWER i podaje gotowe produkty do komponentów — wcześniej
 * każda karuzela sama pytała Sanity z przeglądarki (i wszystkie pokazywały tę
 * samą kategorię). Błąd jednej sekcji (Sanity, baza, Redis) nie wywraca strony:
 * sekcja dostaje pustą listę i się nie pokazuje.
 */

type Fetcher = <T>(query: string, params: Record<string, unknown>) => Promise<T>

/** Sklep: cache Next 60 s + unieważnianie tagami Sanity (jak reszta sklepu). */
const cachedFetch: Fetcher = async <T,>(query: string, params: Record<string, unknown>) => {
  const { data } = await sanityFetch({ query, params })
  return data as T
}

/** Panel (podgląd): zawsze świeże dane opublikowane, bez CDN i cache. */
const published = sanityClient.withConfig({ perspective: 'published', useCdn: false })
export const freshFetch: Fetcher = <T,>(query: string, params: Record<string, unknown>) =>
  published.fetch<T>(query, params)

// Ta sama projekcja co karuzele klienckie (clientRequest.ts → getCarouselProduct),
// żeby kafelek ProductItem2 dostał komplet danych (warianty, filtry, flagi).
const PRODUCT_PROJECTION = `{
  ...,
  category->{ _id, title, slug },
  type->{ _id, title, slug },
  productOptions[]->{ _id, key, label, type, UX_type },
  filterValues[]->{ filter, _id, value, slug },
  variants[]{
    _key, price, sku, stock,
    optionValues[]{
      _key, label,
      "name": name->{ _id, key, label, type, UX_type },
      "value": value->{ _id, value, slug }
    }
  }
}`

const CANDIDATES = 300

/** Projekcja dokumentu `homeLayout` (z adresem zdjęcia pieska do podglądu i sklepu). */
export const HOME_LAYOUT_PROJECTION = `sections, _updatedAt,
  about{ heading, text, dogTitle, dogName, dogText, showSocial,
    "dogImage": dogImage{ alt, "assetId": asset._ref, "url": asset->url } }`

export async function getHomeLayout(fetcher: Fetcher = cachedFetch): Promise<HomeLayoutData> {
  try {
    const doc = await fetcher<unknown>(`*[_id == $id][0]{ ${HOME_LAYOUT_PROJECTION} }`, { id: HOME_LAYOUT_ID })
    return normalizeHomeLayout(doc)
  } catch (err) {
    console.error('[home] layout failed — domyślny układ', err)
    return normalizeHomeLayout(null)
  }
}

export type ResolvedSection =
  | { section: HomeProductsSection; products: GetSlugProduct[]; moreHref: string | null }
  | {
      section: Exclude<HomeSection, HomeProductsSection>
      products?: undefined
      moreHref?: undefined
      /** treść sekcji „O nas” (tylko dla kind === 'about') */
      about?: HomeAbout
    }

const IN_STOCK = `(
  stock > 0 || count(variants[stock > 0]) > 0 ||
  (!defined(stock) && count(variants[defined(stock)]) == 0)
)`

function sourceFilter(section: HomeProductsSection): { clause: string; params: Record<string, unknown> } | null {
  const refId = section.ref?.id || null
  const refSlug = section.ref?.slug || null
  switch (section.source) {
    case 'all':
      return { clause: 'true', params: {} }
    case 'manual':
      return section.productIds.length ? { clause: '_id in $manual', params: { manual: section.productIds } } : null
    case 'collection':
      if (refId) return { clause: '$ref in collections[]._ref', params: { ref: refId } }
      return refSlug ? { clause: '$refSlug in collections[]->slug.current', params: { refSlug } } : null
    case 'category':
      if (refId) return { clause: 'category._ref == $ref', params: { ref: refId } }
      return refSlug ? { clause: 'category->slug.current == $refSlug', params: { refSlug } } : null
    case 'subcategory':
      if (refId) return { clause: 'type._ref == $ref', params: { ref: refId } }
      return refSlug ? { clause: 'type->slug.current == $refSlug', params: { refSlug } } : null
  }
}

/** Fisher–Yates — kolejność „Losowo” (zestaw zmienia się przy odświeżeniu cache strony). */
export function shuffled<T>(list: T[], random: () => number = Math.random): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

async function orderProducts(products: GetSlugProduct[], section: HomeProductsSection): Promise<GetSlugProduct[]> {
  if (section.order === 'manual' && section.source === 'manual') {
    const position = new Map(section.productIds.map((id, index) => [id, index]))
    return [...products].sort((a, b) => (position.get(a._id) ?? 999) - (position.get(b._id) ?? 999))
  }
  if (section.order === 'random') {
    // „Tylko w promocji” potrzebuje obniżek z rejestru cen — reszta bez sygnałów.
    let list = products
    if (section.onlyDiscounted) {
      const discounts = await getDiscounts(products).catch((e) => {
        console.error('[home] discounts', e)
        return null
      })
      list = list.filter((p) => (discounts?.get(p._id) ?? 0) > 0)
    }
    return shuffled(list)
  }
  const sort: ProductSort =
    section.order === 'featured' || section.order === 'manual' ? 'popular' : (section.order as ProductSort)

  const signals: SortSignals = {}
  const needPopularity = sort === 'popular' || sort === 'discount'
  const needRating = sort === 'popular' || sort === 'rating'
  await Promise.all([
    needPopularity
      ? getPopularityScores().then((m) => void (signals.popularity = m)).catch((e) => console.error('[home] popularity', e))
      : null,
    needRating
      ? getRatings(products.map((p) => p._id)).then((m) => void (signals.rating = m)).catch((e) => console.error('[home] ratings', e))
      : null,
    sort === 'discount' || section.onlyDiscounted
      ? getDiscounts(products).then((m) => void (signals.discount = m)).catch((e) => console.error('[home] discounts', e))
      : null,
  ])

  let list = products
  if (section.onlyDiscounted) list = list.filter((p) => (signals.discount?.get(p._id) ?? 0) > 0)

  // „Najczęściej zamawiane” liczy CZYSTĄ sprzedaż (bez podbijania promowanych
  // w sortProducts), a „Promowane i bestsellery” — najpierw wyróżnienia.
  if (section.order === 'popular') {
    const units = (id: string) => signals.popularity?.get(id) ?? 0
    const sorted = sortProducts(list, 'popular', signals)
    return [...sorted].sort((a, b) => units(b._id) - units(a._id) || sorted.indexOf(a) - sorted.indexOf(b))
  }
  const sorted = sortProducts(list, sort, signals)
  if (section.order === 'featured') {
    return [...sorted].sort((a, b) => promotionRank(b) - promotionRank(a) || sorted.indexOf(a) - sorted.indexOf(b))
  }
  return sorted
}

async function moreHrefFor(section: HomeProductsSection, fetcher: Fetcher): Promise<string | null> {
  if (!section.showMoreLink) return null
  if (section.source !== 'collection' && section.source !== 'subcategory') return null
  let slug = section.ref?.slug || null
  if (section.ref?.id) {
    slug = (await fetcher<string | null>(`*[_id == $id][0].slug.current`, { id: section.ref.id }).catch(() => null)) ?? slug
  }
  if (!slug) return null
  return section.source === 'collection' ? `/kolekcje/${slug}` : `/subcategory/${slug}`
}

export async function resolveProductsSection(
  section: HomeProductsSection,
  fetcher: Fetcher = cachedFetch,
): Promise<{ products: GetSlugProduct[]; moreHref: string | null }> {
  const source = sourceFilter(section)
  const pinned = section.pinnedIds.filter((id) => !section.excludedIds.includes(id))

  const filters = [
    '_type == "product"',
    'defined(slug.current)',
    '!(_id in $excluded)',
    section.onlyFeatured ? 'isFeatured == true' : null,
    section.onlyBestseller ? 'isBestseller == true' : null,
    section.onlyNew ? 'isNew == true' : null,
    section.onlyInStock ? IN_STOCK : null,
  ].filter(Boolean)

  const [candidates, pinnedDocs, moreHref] = await Promise.all([
    source
      ? fetcher<GetSlugProduct[]>(
          `*[${[...filters, source.clause].join(' && ')}] | order(_createdAt desc) [0...${CANDIDATES}] ${PRODUCT_PROJECTION}`,
          { excluded: section.excludedIds, ...source.params },
        )
      : Promise.resolve([] as GetSlugProduct[]),
    pinned.length
      ? fetcher<GetSlugProduct[]>(`*[_type == "product" && defined(slug.current) && _id in $pinned] ${PRODUCT_PROJECTION}`, { pinned })
      : Promise.resolve([] as GetSlugProduct[]),
    moreHrefFor(section, fetcher),
  ])

  const ordered = await orderProducts(candidates ?? [], section)
  const pinnedOrdered = pinned
    .map((id) => (pinnedDocs ?? []).find((p) => p._id === id))
    .filter((p): p is GetSlugProduct => Boolean(p))
  const pinnedSet = new Set(pinnedOrdered.map((p) => p._id))
  const products = [...pinnedOrdered, ...ordered.filter((p) => !pinnedSet.has(p._id))].slice(0, section.limit)
  return { products, moreHref }
}

/** Wszystkie włączone sekcje z gotową zawartością; puste karuzele znikają. */
export async function resolveHomeSections(layout?: HomeLayoutData): Promise<ResolvedSection[]> {
  const data = layout ?? (await getHomeLayout())
  const resolved = await Promise.all(
    data.sections
      .filter((section) => section.enabled)
      .map(async (section): Promise<ResolvedSection | null> => {
        if (section.kind === 'about') return { section, about: data.about }
        if (section.kind !== 'products') return { section }
        try {
          const { products, moreHref } = await resolveProductsSection(section)
          return products.length ? { section, products, moreHref } : null
        } catch (err) {
          console.error(`[home] sekcja „${section.title}” nie wczytała się`, err)
          return null
        }
      }),
  )
  return resolved.filter((entry): entry is ResolvedSection => Boolean(entry))
}
