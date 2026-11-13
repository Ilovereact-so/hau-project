import { GetSlugProduct, Product, Subcategory } from "../../../sanity.types"
import { client } from "../lib/client"
import type { ProductPromotion } from "@/lib/promotion"
import { buildMenuTree, MENU_FIELDS_GROQ } from "../../lib/menuOrder"

type SubcategoryNode = {
    _id: string;
    title: string;
    slug: string;
    imageWithAlt: Subcategory['imageWithAlt'];
}
export type CategoryNode = {
    _id: string;
    title: string;
    slug: string;
    subcategory?: SubcategoryNode[]
}
export async function getSubcategories(): Promise<CategoryNode[]> {
    // Cache + dedup jak w getCarouselProduct/getLatestGuidesClient niżej — bez tego
    // każde wejście na stronę główną odpalało zapytanie od nowa (a przy React
    // StrictMode w devie nawet dwa równoległe).
    if (subcategoriesCache && Date.now() - subcategoriesCache.ts < SUBCATEGORIES_CACHE_TTL_MS) {
        return subcategoriesCache.data
    }
    if (subcategoriesInflight) return subcategoriesInflight

    // Kolejność i ukrycie z panelu (Produkty → Menu sklepu) — ukryta
    // podkategoria (albo cała kategoria) nie trafia do kafelków na stronie głównej.
    const query = `*[_type=="category"]{
  _id,
  title,
  "slug": slug.current,
  ${MENU_FIELDS_GROQ},
  "subcategory": *[_type=="subcategory" && parent._ref == ^._id]{
    _id, title, "slug": slug.current, imageWithAlt, ${MENU_FIELDS_GROQ}
  }
}`

    const promise = (async () => {
        try {
            const data = await client.fetch<CategoryNode[]>(query);
            const sumData = buildMenuTree(data ?? []).map((c)=>({
                _id: c._id,
                title: c.title,
                slug: c.slug,
                subcategory: c.subcategory
            }))
            subcategoriesCache = { data: sumData, ts: Date.now() }
            return sumData
        } catch (error) {
            console.error("Error fetching subcategories:", error);
            return [];
        } finally {
            subcategoriesInflight = null
        }
    })()

    subcategoriesInflight = promise
    return promise
}

const SUBCATEGORIES_CACHE_TTL_MS = 60_000
let subcategoriesCache: { data: CategoryNode[]; ts: number } | null = null
let subcategoriesInflight: Promise<CategoryNode[]> | null = null
export type ProductSearchResult = {
    _id: string;
    title: string;
    subtitle?: string;
    brand?: string;
    slug: string;
    price: number;
    compareAtPrice?: number;
    variants?: Array<{
        _key: string;
        price: number;
        stock?: number | null;
    }>;
    promotion?: ProductPromotion | null;
    images: Product['images'];
    category: {
        title: string;
        slug: string;
    };
    type: {
        title: string;
        slug: string;
    };
}
/**
 * Podpowiedzi wyszukiwarki — z `/api/search` (dopasowanie po nazwie, marce,
 * kategoriach, tagach, SKU i opisach liczy serwer: lib/search.ts).
 */
export const searchProductsByName = async (name: string, controller: AbortController): Promise<ProductSearchResult[]> => {
    if (name.trim().length < 2) return []
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(name.trim())}`, { signal: controller.signal })
        if (!res.ok) return []
        const data = (await res.json()) as { results?: ProductSearchResult[] }
        return (data.results ?? []).filter((item) => item?.slug && item?.title)
    } catch (error) {
        if ((error as Error)?.name !== "AbortError") console.error("Error fetching products by name:", error);
        return [];
    }
}

// Pula nazw produktów pod "Popularne" w search — pokazywane zamiast "Ostatnio
// wyszukiwane" wyłącznie gdy user nie ma jeszcze żadnej historii. Losowanie
// podzbioru robimy po stronie klienta (patrz usePopularSearches) — GROQ w tej
// wersji Sanity nie ma natywnego sample(), a losowanie 30 tytułów po stronie
// klienta jest wystarczająco tanie.
export type PopularProductName = {
    _id: string;
    title: string;
}
export const getProductTitlesPool = async (): Promise<PopularProductName[]> => {
    const QUERY = `*[_type=="product" && defined(title)]{_id, title}[0...100]`
    try {
        const data = await client.fetch<PopularProductName[]>(QUERY)
        return data || []
    } catch (error) {
        console.error("Error fetching product titles pool:", error);
        return [];
    }
}

// Wariant rzucający wyjątkiem — dla kodu, który musi odróżnić "produkt zniknął
// z katalogu" od "Sanity nie odpowiedziało" (scalanie koszyka po zalogowaniu
// nie może wtedy wyczyścić danych użytkownika).
export const fetchProductsByIds = async (ids: string[]): Promise<GetSlugProduct[]> => {
    if (ids.length === 0) return []
    const QUERY = `*[_type == "product" && _id in $ids]{
    ...,
    category->{
    _id,
    title,
    slug
    },
    type->{
    _id,
    title,
    slug
    },
    productOptions[]->{
      _id,
      key,
      label,
      type,
      UX_type
    },
    filterValues[]->{
      filter,
      _id,
      value,
      slug
    },
    variants[]{
      _key,
      price,
      sku,
      stock,
      optionValues[]{
        _key,
        label,
        "name":name->{
          _id,
          key,
          label,
          type,
          UX_type
        },
        "value":value->{
          _id,
          value,
          slug
        }
      }
    }
  }`
    return client.fetch<GetSlugProduct[]>(QUERY, { ids })
}

export const getProductForWishList = async (ids: string[]) => {
    try {
        return await fetchProductsByIds(ids)
    } catch (error) {
        console.error("Error fetching products by ids:", error);
        return [];
    }
}
// Cache + dedup per kategorię (slug). Bez tego każdy zamontowany
// <ProductCarusel2 /> (a jest ich kilka naraz na stronie głównej — patrz
// ContentContainer.tsx — plus jeszcze jeden w (client)/layout.tsx) odpalał
// identyczne zapytanie GROQ (ta sama, mocno zagnieżdżona projekcja: category,
// type, productOptions, filterValues, warianty z optionValues i ich
// dereferencjami) w osobnym useEffect, kompletnie niezależnie od pozostałych.
// Przy 3 karuzelach na stronie głównej to 3 identyczne, równoległe requesty do
// Sanity (plus po ~20 requestów obrazków na każdą) zamiast jednego.
// carouselInflight scala równoległe wywołania dla tego samego slug w jeden
// request; carouselCache serwuje kolejne mounty tego samego slug (np. powrót
// na stronę główną w ramach tej samej sesji) bez ponownego zapytania przez
// CAROUSEL_CACHE_TTL_MS.
const CAROUSEL_CACHE_TTL_MS = 60_000
const carouselCache: Map<string, { data: GetSlugProduct[]; ts: number }> = new Map()
const carouselInflight: Map<string, Promise<GetSlugProduct[]>> = new Map()

export const getCarouselProduct = async (params: string) => {
  const cached = carouselCache.get(params)
  if (cached && Date.now() - cached.ts < CAROUSEL_CACHE_TTL_MS) {
    return cached.data
  }

  const inflight = carouselInflight.get(params)
  if (inflight) return inflight

  const QUERY = `*[_type == "product" && defined(category) &&
    category->slug.current == $slug]{
    ...,
    category->{
    _id,
    title,
    slug
    },
    type->{
    _id,
    title,
    slug
    },
    productOptions[]->{
      _id,
      key,
      label,
      type,
      UX_type
    },
    filterValues[]->{
      filter,
      _id,
      value,
      slug
    },
    variants[]{
      _key,
      price,
      sku,
      stock,
      optionValues[]{
        _key,
        label,
        "name":name->{
          _id,
          key,
          label,
          type,
          UX_type
        },
        "value":value->{
          _id,
          value,
          slug
        }
      }
    }
  }[0...20]
  `

  const promise = (async () => {
    try {
      const data = await client.fetch<GetSlugProduct[]>(QUERY, { slug: params });
      carouselCache.set(params, { data, ts: Date.now() });
      return data;
    } catch (error) {
      console.error("Error fetching products by name:", error);
      return [];
    } finally {
      carouselInflight.delete(params);
    }
  })();

  carouselInflight.set(params, promise);
  return promise;
}
// ── Poradniki (klient) ────────────────────────────────────────────────────────
// Strona główna (`app/(using)/page.tsx`) jest komponentem klienckim, więc moduł
// poradników — tak samo jak bannery i karuzele produktów — pobiera dane przez
// `client.fetch`, a nie przez server-only `sanityFetch`. Cache + dedup jak przy
// karuzelach: bez tego powrót na stronę główną w ramach jednej sesji odpalałby
// zapytanie od nowa, a przy React StrictMode w devie nawet dwa naraz.
export type GuideCardData = {
    _id: string;
    title: string;
    slug: string;
    excerpt: string;
    coverImage?: any;
    category?: { _id: string; title: string; slug: string } | null;
    publishedAt?: string;
    readingTime?: number;
    estimatedReadingTime?: number;
    hasVideo?: boolean;
}

const GUIDES_CACHE_TTL_MS = 60_000
let guidesCache: { data: GuideCardData[]; ts: number } | null = null
let guidesInflight: Promise<GuideCardData[]> | null = null

export const getLatestGuidesClient = async (limit = 8): Promise<GuideCardData[]> => {
    if (guidesCache && Date.now() - guidesCache.ts < GUIDES_CACHE_TTL_MS) {
        return guidesCache.data
    }
    if (guidesInflight) return guidesInflight

    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 24) : 8
    const QUERY = `*[_type == "guide" && defined(slug.current) && publishedAt <= now()]
        | order(publishedAt desc)[0...${safeLimit}]{
        _id,
        title,
        "slug": slug.current,
        excerpt,
        coverImage,
        "category": category->{_id, title, "slug": slug.current},
        publishedAt,
        readingTime,
        "estimatedReadingTime": round(length(pt::text(body)) / 1300),
        "hasVideo": defined(heroVideo.url) || defined(heroVideo.file)
    }`

    const promise = (async () => {
        try {
            const data = await client.fetch<GuideCardData[]>(QUERY)
            guidesCache = { data: data || [], ts: Date.now() }
            return data || []
        } catch (error) {
            console.error("Error fetching guides:", error);
            return [];
        } finally {
            guidesInflight = null
        }
    })()

    guidesInflight = promise
    return promise
}
