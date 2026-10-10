import { defineQuery } from "next-sanity";
import { sanityFetch } from "../lib/live";
import { BanerVariants, GetSlugProduct, METHODS_QUERYResult } from "sanity.types";
import { collectionOrderClause, isCollectionSort, type CollectionSort } from "../lib/collectionRefs";
import { client } from "../lib/client";


export const getShippingMethods = async (): Promise<METHODS_QUERYResult> => {
  const METHODS_QUERY = defineQuery(`*[_type=="shipping_methods"] | order(name asc)`);
  try {
    const shipping_methods = await sanityFetch({
      query: METHODS_QUERY,
    });
    return shipping_methods.data || [];
  } catch (error) {
    console.error("Error fetching Shipping methods:", error);
    return [];
  }
};

// ── Banery strony głównej ─────────────────────────────────────────────────────
// Serverowa wersja getAllBaners z clientRequest.ts. Strona główna była komponentem
// 'use client' i pobierała banery w useEffect — user przez pierwsze sekundy po
// odświeżeniu widział pusty hero. Teraz page.tsx jest server componentem, pobiera
// banery przez sanityFetch (z cache Next via fetchOptions.revalidate w lib/live)
// i przekazuje gotowe dane do klientowej karuzeli jako props.
/**
 * Baner z rozwiniętą kolekcją. `collectionLink` jest `null`, gdy baner nie ma
 * kolekcji albo kolekcja nie jest opublikowana / nie ma adresu — wtedy
 * karuzela nie pokazuje przycisku (zamiast linkować w 404).
 */
export type HomeBanner = BanerVariants & {
  collectionLink?: { title?: string | null; slug?: string | null } | null;
};

export const getBaners = async (): Promise<HomeBanner[]> => {
  const BANERS_QUERY = defineQuery(`*[_type=="banerVariants"]{
    ...,
    "collectionLink": collection->{ title, "slug": slug.current }
  }`);
  try {
    const res = await sanityFetch({ query: BANERS_QUERY });
    return (res?.data as HomeBanner[]) || [];
  } catch (error) {
    console.error("Error fetching baners:", error);
    return [];
  }
};

export const getAllProducts = async () => {
  const PRODUCTS_QUERY = defineQuery(`*[_type=="product"] | order(name asc)`);
  try {
    const products = await sanityFetch({
      query: PRODUCTS_QUERY,
    });
    return products.data || [];
  } catch (error) {
    console.error("Error fetching all products:", error);
    return [];
  }
};

export const getAllCategories = async (quantity?: number) => {
  const CATEGORIES_QUERY = `*[_type=="category"] | order(name asc)${quantity ? `[0...${quantity}]` : ""}`;

  try {
    const categories = await sanityFetch({
      query: CATEGORIES_QUERY,
    });
    return categories?.data || [];
  } catch (error) {
    console.error("Error fetching all categories:", error);
    return [];
  }
};

// export const searchProductsByName = async (searchParam: string, controller: AbortController) => {
//   const PRODUCT_SEARCH_QUERY = defineQuery(
//     `*[_type == "product" && title match $searchParam] | order(title asc)`
//   );

//   try {
//     const products = await sanityFetch({
//       query: PRODUCT_SEARCH_QUERY,
//       params: {
//         searchParam: `${searchParam}`,
//       },
//       signal: controller.signal,
//     });
//     return products?.data || [];
//   } catch (error) {
//     console.error("Error fetching products by name:", error);
//     return [];
//   }
// };
type CategoryType = {
  _id: string;
  title: string;
  slug: string;
};
export type SubcategoryWithCategory = {
  _id: string;
  title: string;
  slug: string;
  description: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  /** Długi opis SEO (Portable Text) — na dole strony listingu. */
  seoContent?: unknown[] | null;
  availableFilters?:Array<{
    _id:string,
    key:string,
    label:string,
    type:string,
    UX_type: string
  }>
  imageWithAlt: {
    asset: {
      _ref: string;
    };
    alt: string;
  };
  category: CategoryType
};

export const getSubCategoryBySlug = async(slug: string) => {
  const SUBCATEGORY_BY_ID_QUERY = defineQuery(
    `*[_type == "subcategory" && slug.current == $slug]{
      _id,
      title, 
      "slug": slug.current, 
      description,
      metaTitle,
      metaDescription,
      seoContent,
      availableFilters[]->{
        _id,
        key,
        label,
        type,
        UX_type
      }, 
      imageWithAlt, 
      "category": *[_type == "category" && _id == ^.parent._ref]{
        _id,
        title,
        "slug": slug.current
      }[0]
    } | order(name asc) [0]`
  );

  try {
    const subcategory = await sanityFetch({
      query: SUBCATEGORY_BY_ID_QUERY,
      params: {
        slug,
      },
    });
    return subcategory?.data || null;
  } catch (error) {
    console.error("Error fetching subcategory by slug:", error);
    return null;
  }
};
// Na poziomie modułu, bo tej samej projekcji używa podgląd szkicu dla admina
// (lib/productPreview.ts) — produkt w podglądzie wygląda 1:1 jak w sklepie.
export const PRODUCT_BY_ID_QUERY = defineQuery(
    `*[_type == "product" && slug.current == $slug]{
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
  }[0]`
  );

export const getProductBySlug = async (slug: string) => {

  try {
    const product = await sanityFetch({
      query: PRODUCT_BY_ID_QUERY,
      params: {
        slug,
      },
    });
    return product?.data || null;
  } catch (error) {
    console.error("Error fetching product by ID:", error);
    return null;
  }
};

export const getProductsBySubCategory = async (subcategorySlug: string) => {
  const PRODUCT_BY_SUBCATEGORY_QUERY = defineQuery(
    `*[_type == 'product' && references(*[_type == "subcategory" && slug.current == $subcategorySlug]._id)]{
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
  } | order(name asc)`
  );
  try {
    const products = await sanityFetch({
      query: PRODUCT_BY_SUBCATEGORY_QUERY,
      params: {
        subcategorySlug,
      },
    });
    return products?.data || [];
  } catch (error) {
    console.error("Erroor fetching products by subcategory:", error);
    return [];
  }
};

// ── Projekcja kafelka/listingu ────────────────────────────────────────────────
// Ten sam kształt co PRODUCT_BY_ID_QUERY / getProductsBySubCategory
// (GetSlugProduct) — kafelki, filtry i ceny (z promocją) potrzebują
// wariantów z opcjami, wartości filtrów i flag.
const LISTING_PROJECTION = `{
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
}`;

// Aktywna promocja w GROQ — wstępny filtr; ostatecznie decyduje
// isPromotionActive (lib/promotion.ts), bo wynik zapytania bywa z cache.
const ACTIVE_PROMOTION_FILTER = `promotion.enabled == true && defined(promotion.value)
  && (!defined(promotion.startsAt) || dateTime(promotion.startsAt) <= dateTime(now()))
  && (!defined(promotion.endsAt) || dateTime(promotion.endsAt) > dateTime(now()))`;

export type CategoryDetails = {
  _id: string;
  title: string;
  slug: string;
  description?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  seoContent?: unknown[] | null;
  subcategories: Array<{
    _id: string;
    title: string;
    slug: string;
    availableFilters?: SubcategoryWithCategory["availableFilters"];
  }>;
};

/** Kategoria główna (menu: Zabawki, Przysmaki…) z podkategoriami i ich filtrami. */
export const getCategoryBySlug = async (slug: string): Promise<CategoryDetails | null> => {
  const QUERY = `*[_type == "category" && slug.current == $slug][0]{
    _id, title, "slug": slug.current, description, metaTitle, metaDescription, seoContent,
    "subcategories": *[_type == "subcategory" && parent._ref == ^._id] | order(lower(title) asc) {
      _id, title, "slug": slug.current,
      availableFilters[]->{ _id, key, label, type, UX_type }
    }
  }`;
  try {
    const res = await sanityFetch({ query: QUERY, params: { slug } });
    return (res?.data as CategoryDetails | null) ?? null;
  } catch (error) {
    console.error("Error fetching category by slug:", error);
    return null;
  }
};

/**
 * Produkty kategorii głównej: przypisane wprost (`category`) albo przez
 * podkategorię, której rodzicem jest ta kategoria.
 */
export const getProductsByCategory = async (categoryId: string): Promise<GetSlugProduct[]> => {
  const QUERY = `*[_type == "product" && (category._ref == $id || type->parent._ref == $id)] | order(lower(title) asc) [0...1000] ${LISTING_PROJECTION}`;
  try {
    const res = await sanityFetch({ query: QUERY, params: { id: categoryId } });
    return (res?.data as GetSlugProduct[]) || [];
  } catch (error) {
    console.error("Error fetching products by category:", error);
    return [];
  }
};

/** Produkty z aktywną promocją (karuzela „Produkty w promocji”). */
export const getPromotedProducts = async (limit = 12, excludeId?: string): Promise<GetSlugProduct[]> => {
  const safeLimit = Math.max(1, Math.min(24, Math.floor(limit)));
  const QUERY = `*[_type == "product" && _id != $exclude && ${ACTIVE_PROMOTION_FILTER}] | order(_updatedAt desc) [0...${safeLimit * 2}] ${LISTING_PROJECTION}`;
  try {
    const res = await sanityFetch({ query: QUERY, params: { exclude: excludeId ?? "" } });
    return (res?.data as GetSlugProduct[]) || [];
  } catch (error) {
    console.error("Error fetching promoted products:", error);
    return [];
  }
};

/** Inne produkty z tej samej podkategorii (zapas, gdy nic nie jest w promocji). */
export const getRelatedProducts = async (subcategoryId: string, excludeId: string, limit = 12): Promise<GetSlugProduct[]> => {
  const safeLimit = Math.max(1, Math.min(24, Math.floor(limit)));
  const QUERY = `*[_type == "product" && type._ref == $sub && _id != $exclude] | order(_updatedAt desc) [0...${safeLimit}] ${LISTING_PROJECTION}`;
  try {
    const res = await sanityFetch({ query: QUERY, params: { sub: subcategoryId, exclude: excludeId } });
    return (res?.data as GetSlugProduct[]) || [];
  } catch (error) {
    console.error("Error fetching related products:", error);
    return [];
  }
};

// Wyszukiwarka: dopasowanie liczy lib/search.ts na indeksie wszystkich
// produktów (nazwa, marka, kategorie, tagi, SKU, krótki i pełny opis —
// lib/searchIndex.server.ts), a tu dociągamy PEŁNĄ projekcję (GetSlugProduct:
// warianty z opcjami, filtry) dla trafień — strona /search renderuje ten sam
// dock filtrów i kafelki co subkategoria. Kolejność = trafność.
export const getProductsBySearch = async (query: string): Promise<GetSlugProduct[]> => {
  const { searchProductIds } = await import("@/lib/searchIndex.server");
  const ids = await searchProductIds(query, 200);
  if (!ids.length) return [];
  try {
    const res = await sanityFetch({
      query: `*[_type == "product" && _id in $ids] ${LISTING_PROJECTION}`,
      params: { ids },
    });
    const products = (res?.data as GetSlugProduct[]) || [];
    const order = new Map(ids.map((id, index) => [id, index]));
    return products.sort((a, b) => (order.get(a._id) ?? 0) - (order.get(b._id) ?? 0));
  } catch (error) {
    console.error("Error fetching products by search:", error);
    return [];
  }
};

// Filtry dostępne dla wyników wyszukiwania nie są przypisane do jednej
// subkategorii (tak jak SubcategoryWithCategory.availableFilters) — wyniki
// mogą pochodzić z wielu kategorii naraz. Zamiast tego budujemy je dynamicznie
// z unikalnych "filter._ref" faktycznie występujących w filterValues znalezionych
// produktów (patrz src/app/(products)/search/page.tsx), a ta funkcja dereferencuje
// te id do {_id, key, label, type, UX_type} — dokładnie kształt, jakiego oczekuje
// SubcategoryFilterContainer w subcategoryDetails.availableFilters.
export const getFiltersByIds = async (ids: string[]) => {
  if (ids.length === 0) return [];
  const FILTERS_BY_ID_QUERY = defineQuery(
    `*[_type == "filter" && _id in $ids]{
      _id,
      key,
      label,
      type,
      UX_type
    }`
  );
  try {
    const filters = await sanityFetch({
      query: FILTERS_BY_ID_QUERY,
      params: { ids },
    });
    return filters?.data || [];
  } catch (error) {
    console.error("Error fetching filters by ids:", error);
    return [];
  }
};

// ── Centrum pomocy ────────────────────────────────────────────────────────────
// Treść dokumentów (Regulamin, Dostawa, ...) trzymana jako Portable Text w
// Sanity — admin edytuje je w /studio, a docelowo przez własny panel piszący do
// tego samego typu `helpDocument`. Strona nie musi wtedy zmieniać niczego.

export type HelpDocument = {
  _id: string;
  title: string;
  slug: string;
  lead?: string;
  // Portable Text — surowa tablica bloków. Typujemy luźno, bo kształt bloku
  // zależy od tego, co admin wklei; renderer (PortableTextContent) i tak
  // obsługuje tylko znane style, a nieznane pomija.
  body?: any[];
  updatedAt?: string;
  order?: number;
};

export const getHelpDocumentBySlug = async (slug: string): Promise<HelpDocument | null> => {
  // Zapytanie celowo jako jeden literał (bez interpolacji wspólnej projekcji) —
  // `sanity typegen generate` analizuje treść defineQuery statycznie i nie
  // poradziłby sobie ze sklejanym stringiem.
  const HELP_DOCUMENT_QUERY = defineQuery(
    `*[_type == "helpDocument" && slug.current == $slug][0]{
      _id,
      title,
      "slug": slug.current,
      lead,
      body,
      updatedAt,
      order
    }`
  );
  try {
    const doc = await sanityFetch({
      query: HELP_DOCUMENT_QUERY,
      params: { slug },
    });
    return (doc?.data as HelpDocument) || null;
  } catch (error) {
    console.error("Error fetching help document by slug:", error);
    return null;
  }
};

// Lista wszystkich dokumentów — do indeksu /help, sidebara i generateStaticParams.
// Bez `body`, żeby nie ciągnąć całej treści każdego regulaminu tylko po tytuły.
export const getAllHelpDocuments = async (): Promise<HelpDocument[]> => {
  const ALL_HELP_DOCUMENTS_QUERY = defineQuery(
    `*[_type == "helpDocument" && defined(slug.current)] | order(order asc, title asc){
      _id,
      title,
      "slug": slug.current,
      lead,
      updatedAt,
      order
    }`
  );
  try {
    const docs = await sanityFetch({ query: ALL_HELP_DOCUMENTS_QUERY });
    return (docs?.data as HelpDocument[]) || [];
  } catch (error) {
    console.error("Error fetching help documents:", error);
    return [];
  }
};

export const getSale = async () => {
  const SALE_QUERY = defineQuery(`*[_type == 'sale'] | order(name asc)`);
  try {
    const products = await sanityFetch({
      query: SALE_QUERY,
    });
    return products?.data || [];
  } catch (error) {
    console.error("Error fetching products by category:", error);
    return [];
  }
};

export const getMyOrders = async (userId: string) => {
  if (!userId) {
    throw new Error("User ID is required");
  }
  const MY_ORDERS_QUERY =
    defineQuery(`*[_type == 'order' && clerkUserId == $userId] | order(orderData desc){
    ...,products[]{
      ...,product->
    }
  }`);

  try {
    const orders = await sanityFetch({
      query: MY_ORDERS_QUERY,
      params: { userId },
    });
    return orders?.data || [];
  } catch (error) {
    console.error("Error fetching orders:", error);
    return [];
  }
};
// ── Poradniki ─────────────────────────────────────────────────────────────────
// Osobna gałąź treści (typ `guide` + `guideCategory` w Sanity), niezależna od
// drzewa produktów. Query pisane jako zwykłe stringi, a nie defineQuery —
// `sanity typegen` nie zna jeszcze tych typów (dopóki nie odpali się
// `npm run typegen` po wdrożeniu schematu), a defineQuery bez wpisu w
// sanity.types.ts i tak nie dałby lepszego typowania niż jawne rzutowanie niżej.

export type GuideCategory = {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  order?: number;
};

export type GuideVideo = {
  provider?: 'external' | 'file';
  url?: string;
  /** Zdereferencjonowany adres pliku z Sanity (patrz projekcja "fileUrl" w query). */
  fileUrl?: string;
  poster?: any;
  caption?: string;
};

export type GuideListItem = {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage?: any;
  category?: { _id: string; title: string; slug: string } | null;
  publishedAt?: string;
  readingTime?: number;
  featured?: boolean;
  /** Szacunek z długości treści (GROQ) — kafelek pokazuje `readingTime ?? estimatedReadingTime`. */
  estimatedReadingTime?: number;
  /** Wyliczone w GROQ, żeby nie ciągnąć całego `body` tylko po znaczek "wideo" na kafelku. */
  hasVideo?: boolean;
};

export type Guide = GuideListItem & {
  author?: string;
  heroVideo?: GuideVideo;
  body?: any[];
  seoTitle?: string;
  seoDescription?: string;
  /** Ostatnia zmiana opublikowanej wersji — „Zaktualizowano …” i `dateModified` w JSON-LD. */
  updatedAt?: string;
};

// Wspólne pola kafelka. Trzymane w stałej, bo powtarzają się w czterech
// zapytaniach — rozjechanie się ich oznaczałoby, że ten sam kafelek renderuje
// się inaczej na /poradniki niż w module na stronie głównej.
const GUIDE_CARD_PROJECTION = `
  _id,
  title,
  "slug": slug.current,
  excerpt,
  coverImage,
  "category": category->{_id, title, "slug": slug.current},
  publishedAt,
  readingTime,
  // Czas czytania, gdy w Studio/panelu nie wpisano go ręcznie: znaki treści
  // (pt::text) / ~1300 znaków na minutę ≈ 200 słów/min — ta sama skala co
  // estimateReadingTime. Liczone w GROQ, żeby kafelek nie ciągnął całego body.
  "estimatedReadingTime": round(length(pt::text(body)) / 1300),
  featured,
  "hasVideo": defined(heroVideo.url) || defined(heroVideo.file)
`;

// Poradniki z datą publikacji w przyszłości są ukryte — to jest cała mechanika
// "zaplanuj wpis": admin ustawia datę do przodu i wpis pojawia się sam.
const PUBLISHED_GUIDE_FILTER = `_type == "guide" && defined(slug.current) && publishedAt <= now()`;

export const getGuideCategories = async (): Promise<GuideCategory[]> => {
  const QUERY = `*[_type == "guideCategory" && defined(slug.current)] | order(order asc, title asc){
    _id,
    title,
    "slug": slug.current,
    description,
    order
  }`;
  try {
    const res = await sanityFetch({ query: QUERY });
    return (res?.data as GuideCategory[]) || [];
  } catch (error) {
    console.error("Error fetching guide categories:", error);
    return [];
  }
};

export const getAllGuides = async (): Promise<GuideListItem[]> => {
  const QUERY = `*[${PUBLISHED_GUIDE_FILTER}] | order(publishedAt desc){${GUIDE_CARD_PROJECTION}}`;
  try {
    const res = await sanityFetch({ query: QUERY });
    return (res?.data as GuideListItem[]) || [];
  } catch (error) {
    console.error("Error fetching guides:", error);
    return [];
  }
};

export const getLatestGuides = async (limit = 8): Promise<GuideListItem[]> => {
  // Limit wstrzykiwany jako liczba do slice'a — GROQ nie przyjmuje parametru w
  // [0...$n], a wartość i tak pochodzi wyłącznie z kodu, nie od użytkownika.
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 24) : 8;
  const QUERY = `*[${PUBLISHED_GUIDE_FILTER}] | order(publishedAt desc)[0...${safeLimit}]{${GUIDE_CARD_PROJECTION}}`;
  try {
    const res = await sanityFetch({ query: QUERY });
    return (res?.data as GuideListItem[]) || [];
  } catch (error) {
    console.error("Error fetching latest guides:", error);
    return [];
  }
};

export const getGuideBySlug = async (slug: string): Promise<Guide | null> => {
  // `fileUrl` dereferencjonujemy już w GROQ — inaczej w przeglądarce zostałby
  // sam `_ref` pliku, a złożenie z niego adresu cdn.sanity.io wymagałoby
  // powielania konwencji nazewniczej Sanity po stronie komponentu.
  // `items` w bloku „Polecane produkty”: produkty rozwiązane z (słabych)
  // referencji. Produkt usunięty albo wycofany ze sklepu daje null — filtr
  // [defined(_id) && defined(slug)] go pomija (nawias jest konieczny — bez
  // niego filtr stosuje się do pojedynczego obiektu i zwraca null), więc ramka
  // pokazuje tylko dostępne produkty.
  const QUERY = `*[_type == "guide" && slug.current == $slug][0]{
    ${GUIDE_CARD_PROJECTION},
    author,
    seoTitle,
    seoDescription,
    "updatedAt": _updatedAt,
    heroVideo{
      provider,
      url,
      poster,
      caption,
      "fileUrl": file.asset->url
    },
    body[]{
      ...,
      _type == "videoEmbed" => {
        "fileUrl": file.asset->url
      },
      _type == "productEmbed" => {
        "items": (products[]->{
          _id,
          title,
          subtitle,
          "slug": slug.current,
          price,
          "variants": variants[]{ _key, price },
          promotion,
          "imageUrl": images[0].asset->url
        })[defined(_id) && defined(slug)]
      }
    }
  }`;
  try {
    const res = await sanityFetch({ query: QUERY, params: { slug } });
    return (res?.data as Guide) || null;
  } catch (error) {
    console.error("Error fetching guide by slug:", error);
    return null;
  }
};

/** Poradniki "zobacz też": najpierw z tej samej kategorii, potem pozostałe. */
export const getRelatedGuides = async (
  slug: string,
  categoryId?: string,
  limit = 3
): Promise<GuideListItem[]> => {
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 12) : 3;
  const QUERY = `*[${PUBLISHED_GUIDE_FILTER} && slug.current != $slug]
    | order(select(category._ref == $categoryId => 0, 1) asc, publishedAt desc)[0...${safeLimit}]{${GUIDE_CARD_PROJECTION}}`;
  try {
    const res = await sanityFetch({
      query: QUERY,
      params: { slug, categoryId: categoryId ?? "" },
    });
    return (res?.data as GuideListItem[]) || [];
  } catch (error) {
    console.error("Error fetching related guides:", error);
    return [];
  }
};

// ── Kolekcje ──────────────────────────────────────────────────────────────────
// Przynależność trzyma produkt (`collections[]` — słabe referencje), więc
// produkty kolekcji to `*[_type == "product" && $id in collections[]._ref]`.
// Sanity w perspektywie `published` zwraca tylko opublikowane dokumenty —
// szkic kolekcji (np. utworzony automatycznie przy dodawaniu produktu) nie ma
// strony, dopóki ktoś go nie opublikuje.

export type CollectionSummary = {
  _id: string;
  title: string;
  slug: string;
  description?: string | null;
  image?: { asset?: { _ref: string }; alt?: string | null; hotspot?: unknown; crop?: unknown } | null;
  productCount: number;
  coverProductImage?: { asset?: { _ref: string } } | null;
};

export type CollectionDetail = CollectionSummary & {
  sort?: CollectionSort | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  products: GetSlugProduct[];
};

const COLLECTION_FIELDS = `
  _id,
  title,
  "slug": slug.current,
  description,
  "image": imageWithAlt,
  "productCount": count(*[_type == "product" && ^._id in collections[]._ref]),
  "coverProductImage": *[_type == "product" && ^._id in collections[]._ref && defined(images[0].asset)] | order(_createdAt desc)[0].images[0]
`;

// Ta sama projekcja co PRODUCT_BY_SUBCATEGORY_QUERY — kafelki listingu
// (ProductItemWithoutBTN, filtry wariantów) oczekują dokładnie tego kształtu.
const COLLECTION_PRODUCT_PROJECTION = `{
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
}`;

/** Opublikowane kolekcje z adresem — strona /kolekcje. */
export const getAllCollections = async (): Promise<CollectionSummary[]> => {
  try {
    const res = await sanityFetch({
      query: `*[_type == "collection" && defined(slug.current)] | order(lower(title) asc){${COLLECTION_FIELDS}}`,
    });
    return (res?.data as CollectionSummary[]) || [];
  } catch (error) {
    console.error("Error fetching collections:", error);
    return [];
  }
};

/**
 * Kolekcja z produktami. `sortOverride` (z adresu) ma pierwszeństwo przed
 * domyślną kolejnością ustawioną w Studio. Zwraca `null`, gdy kolekcja nie
 * istnieje albo nie jest opublikowana. Rzuca przy awarii Sanity — strona
 * pokazuje wtedy error boundary zamiast udawać, że kolekcji nie ma.
 */
export const getCollectionBySlug = async (
  slug: string,
  sortOverride?: CollectionSort | null
): Promise<CollectionDetail | null> => {
  const meta = await sanityFetch({
    query: `*[_type == "collection" && slug.current == $slug][0]{${COLLECTION_FIELDS}, sort, metaTitle, metaDescription}`,
    params: { slug },
  });
  const collection = meta?.data as Omit<CollectionDetail, "products"> | null;
  if (!collection?._id) return null;

  const sort: CollectionSort = sortOverride ?? (isCollectionSort(collection.sort) ? collection.sort : "newest");
  const products = await sanityFetch({
    query: `*[_type == "product" && $id in collections[]._ref] | ${collectionOrderClause(sort)} [0...500] ${COLLECTION_PRODUCT_PROJECTION}`,
    params: { id: collection._id },
  });

  return { ...collection, sort, products: (products?.data as GetSlugProduct[]) || [] };
};

// ── Mapa strony ───────────────────────────────────────────────────────────────
// Lekkie zapytanie tylko o to, co potrzebne do `sitemap.xml`: adresy i daty
// modyfikacji. Świadomie NIE używa `sanityFetch` (live content) — mapa strony
// generuje się poza kontekstem żądania i wystarcza jej zwykły klient z cache.

export type SitemapEntry = { slug: string; updatedAt?: string | null }

export type SitemapData = {
  products: SitemapEntry[]
  categories: SitemapEntry[]
  subcategories: SitemapEntry[]
  collections: SitemapEntry[]
  guides: SitemapEntry[]
  helpDocuments: SitemapEntry[]
}

const EMPTY_SITEMAP: SitemapData = {
  products: [],
  categories: [],
  subcategories: [],
  collections: [],
  guides: [],
  helpDocuments: [],
}

export const getSitemapData = async (): Promise<SitemapData> => {
  const QUERY = `{
    "products": *[_type == "product" && defined(slug.current) && defined(price)]{ "slug": slug.current, "updatedAt": _updatedAt },
    "categories": *[_type == "category" && defined(slug.current)]{ "slug": slug.current, "updatedAt": _updatedAt },
    "subcategories": *[_type == "subcategory" && defined(slug.current)]{ "slug": slug.current, "updatedAt": _updatedAt },
    "collections": *[_type == "collection" && defined(slug.current) && count(*[_type == "product" && ^._id in collections[]._ref]) > 0]{ "slug": slug.current, "updatedAt": _updatedAt },
    "guides": *[_type == "guide" && defined(slug.current) && publishedAt <= now()]{ "slug": slug.current, "updatedAt": _updatedAt },
    "helpDocuments": *[_type == "helpDocument" && defined(slug.current)]{ "slug": slug.current, "updatedAt": coalesce(updatedAt, _updatedAt) }
  }`
  try {
    // Cache na godzinę — mapa strony nie musi być świeższa niż katalog.
    const data = await client.fetch<SitemapData>(QUERY, {}, { next: { revalidate: 3600 } })
    return { ...EMPTY_SITEMAP, ...data }
  } catch (error) {
    console.error('Error fetching sitemap data:', error)
    return EMPTY_SITEMAP
  }
}
