import React from "react";
import { getProductsBySearch, getFiltersByIds, SubcategoryWithCategory } from "@/sanity/helpers";
import { GetSlugProduct } from "../../../../sanity.types";
import { ArrowDown, ChevronRight } from "lucide-react";
import SortSelect from "@/components/SortSelect";
import { parseProductSort } from "@/lib/productSort";
import { sortProductsForListing } from "@/lib/productListing";
import Image from "next/image";
import ProductItemWithoutBTN from "@/components/ProductItemWithoutBTN";
import SubcategoryFilterContainer from "@/components/SubcategoryFilterContainer";
import Container from "@/components/Container";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";

// Strona wyników wyszukiwania — celowo zbudowana na tym samym layoucie co
// subcategory/[slug]/page.tsx (Container, dock z filtrami, siatka produktów),
// bo user wprost o to poprosił. Różnica: tu nie ma jednej subkategorii z
// gotowym availableFilters, więc budujemy je dynamicznie z filtrów faktycznie
// występujących w znalezionych produktach (patrz buildSearchFilters niżej) i
// pakujemy w "sztuczny" obiekt subcategoryDetails, żeby móc bez zmian użyć
// SubcategoryFilterContainer — łącznie z ostatnio dodanym atrybutem ceny.
// SubcategoryFilterContainer buduje teraz URL filtrów z usePathname() (a nie
// z hardkodowanego /subcategory/${slug}), więc działa tu tak samo jak tam.

// "q" (fraza) i "sort" (kolejność listy) to zarezerwowane klucze w URL — analogicznie do "price"
// (patrz extractPriceFilter w filterProductsByVariantOptions), traktujemy go
// jako parametr specjalny, nie jako klucz filtra. Kolizja z prawdziwym filtrem
// jest praktycznie wykluczona (klucze filtrów pochodzą z Sanity Studio), ale
// i tak wycinamy "q" na wejściu, żeby nigdy nie trafił do parseFiltersFromSearchParams.
function parseFiltersFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>
) {
  const result: Record<string, string[]> = {};

  Object.entries(searchParams).forEach(([key, value]) => {
    if (key === "q" || key === "sort") return;
    if (!value) return;

    result[key] = Array.isArray(value) ? value : [value];
  });

  return result;
}

function extractPriceFilter(filters: Record<string, string[]>) {
  const { price, ...optionFilters } = filters;

  const maxPrice = price?.[0] ? Number(price[0]) : null;

  return {
    maxPrice,
    optionFilters,
  };
}

type Filters = Record<string, string[]>;

function filterProductsByVariantOptions(
  products: GetSlugProduct[],
  filters: Filters
): (GetSlugProduct & { defaultVariant?: string })[] {
  if (Object.keys(filters).length === 0) return products;

  const { maxPrice, optionFilters } = extractPriceFilter(filters);

  return products.reduce<(GetSlugProduct & { defaultVariant?: string })[]>(
    (acc, product) => {
      if (!product.variants?.length) return acc;

      const matchingVariant = product.variants.find(variant => {
        if (maxPrice !== null && variant.price != null && variant.price > maxPrice) {
          return false;
        }

        return Object.entries(optionFilters).every(
          ([filterKey, filterValues]) =>
            variant.optionValues?.some(
              ov =>
                ov.name?.key === filterKey &&
                ov.value?.slug?.current &&
                filterValues.includes(ov.value.slug.current)
            )
        );
      });

      if (!matchingVariant) return acc;

      acc.push({
        ...product,
        defaultVariant: matchingVariant._key,
      });

      return acc;
    },
    []
  );
}

// Filtry na wynikach wyszukiwania nie są przypisane do jednej subkategorii —
// wyniki mogą pochodzić z wielu kategorii naraz. Budujemy je z unikalnych
// filter._ref faktycznie występujących w filterValues znalezionych produktów.
async function buildSearchFilters(products: GetSlugProduct[]) {
  const filterIds = Array.from(
    new Set(
      products.flatMap(
        p =>
          p.filterValues
            ?.map(fv => fv.filter?._ref)
            .filter((id): id is string => Boolean(id)) ?? []
      )
    )
  );
  if (filterIds.length === 0) return [];
  return getFiltersByIds(filterIds);
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const raw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const query = (raw ?? "").trim();
  // Wyniki wyszukiwania nigdy nie idą do indeksu (treść generuje użytkownik),
  // ale linki z nich robot może odwiedzić — stąd `follow`.
  return pageMetadata({
    title: query ? `Wyniki wyszukiwania: ${query}` : "Wyszukiwarka",
    description: query
      ? `Produkty pasujące do frazy „${query}” w sklepie HAU.`
      : "Znajdź akcesoria, przysmaki i zabawki dla psa w sklepie HAU.",
    path: "/search",
    index: false,
  });
}

const SearchPage = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const resolvedSearchParams = await searchParams;
  const rawQuery = resolvedSearchParams.q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery) ?? "";
  const trimmedQuery = query.trim();

  // Sanity `match` na tokenach krótszych niż 2 znaki zwraca praktycznie
  // wszystko (ten sam próg co w useProductSearch po stronie klienta) — więc
  // zamiast zalewać wyniki szumem, po prostu nie odpytujemy w ogóle.
  const products =
    trimmedQuery.length >= 2
      ? ((await getProductsBySearch(trimmedQuery)) as GetSlugProduct[])
      : [];

  const availableFilters = await buildSearchFilters(products);

  const searchSubcategoryDetails: SubcategoryWithCategory = {
    _id: "search-results",
    title: "Wyniki wyszukiwania",
    slug: "search",
    description: trimmedQuery ? `Wyniki dla: "${trimmedQuery}"` : "Wpisz frazę, aby wyszukać",
    availableFilters: availableFilters as SubcategoryWithCategory["availableFilters"],
    imageWithAlt: { asset: { _ref: "" }, alt: "" },
    category: { _id: "search", title: "Wyszukiwanie", slug: "search" },
  };

  const filters = parseFiltersFromSearchParams(resolvedSearchParams);
  const sort = parseProductSort(resolvedSearchParams.sort);
  const filteredProducts = await sortProductsForListing(
    filterProductsByVariantOptions(products, filters),
    sort
  );

  // Ten sam mechanizm co w subcategory/[slug]/page.tsx — patrz komentarz tam.
  const initialMobile = (await headers()).get("x-is-mobile") === "1";

  return (
    // id="sub-category-container" celowo takie samo jak na stronie subkategorii —
    // to cel portalu mobilnego drawera filtrów (hooks/Portal.tsx). Portal ma teraz
    // fallback na document.body, więc nie jest to twarda zależność, ale trzymanie
    // tego samego id daje identyczne zachowanie i stacking context na obu stronach.
    <Container
      id="sub-category-container"
      className="flex justify-center lg:mt-10 md:mt-7 sm:mt-10 mt-7 md:px-10 sm:px-8 px-6 min-h-[100vh] font-poppins"
    >
      <div className="flex flex-col h-full w-auto relative">
        <div className="flex w-full relative z-[3]">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center space-x-2">
              <h1 className="text-black  text-[clamp(14px,1.4vw,16px)]">Wyszukiwanie</h1>
              <ChevronRight className="text-black w-[20px] h-[20px]" />
              <h1 className="text-black  text-[clamp(14px,1.4vw,16px)]">{trimmedQuery || "—"}</h1>
            </div>
            <h1 className="font-medium text-black sm:text-[clamp(18px,2vw,26px)] text-[16px]">
              {trimmedQuery ? `Wyniki dla: „${trimmedQuery}”` : "Wpisz frazę, aby wyszukać"}
            </h1>
          </div>
        </div>
        {/* Dock filtrów — markup 1:1 ze strony subkategorii (ta sama pigułka,
            dekoracyjne /white-holo.png, kolumna "Sortuj"). Renderowany tylko gdy
            jest fraza, bo bez wyników nie ma z czego zbudować listy filtrów. */}
        {trimmedQuery && (
          <div className="flex justify-center w-full mt-[clamp(30px,8vw,80px)]">
            <div className="flex subcategory-dock-shadow relative bg-fancy-black md:py-2 xs:py-3 py-2 md:pt-4 md:px-9 3xs:px-7 xs:px-4 px-3 rounded-full lg:w-[65vw] 2md:w-[70vw] w-[80vw] z-[1] min-h-[50px] max-w-[1350px]">
              <Image
                className="3xs:w-[clamp(300px,33vw,400px)] w-[250px] absolute bottom-[0] xl:left-[-200px] lg:left-[-15vw] 2md:left-[-12vw] left-[-8vw] z-[2] opacity-80"
                src="/white-holo.png"
                alt="white-holo"
                width={460}
                height={330}
              />
              <div className="w-full flex justify-between">
                <div className="flex flex-col w-full z-[3] relative space-y-2 pr-4">
                  <h1 className="text-white text-[clamp(16px,1.4vw,18px)] ml-1 max-md:hidden">Filtruj:</h1>
                  <SubcategoryFilterContainer
                    subcategoryDetails={searchSubcategoryDetails}
                    products={products}
                    paramsFilter={filters}
                    initialMobile={initialMobile}
                  />
                </div>
                <div className="flex md:flex-col flex-row-reverse md:space-y-2 h-fit relative z-[3]">
                  <div className="flex items-center justify-between 3xs:px-4 px-2">
                    <h1 className="text-white text-[clamp(16px,1.4vw,18px)] max-md:hidden">Sortuj:</h1>
                    <ArrowDown className="text-white w-[20px] h-[20px]" />
                  </div>
                  <SortSelect value={sort} />
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="grid justify-items-center 2.5xl:grid-cols-4 lg:grid-cols-4 sm:grid-cols-3 grid-cols-2 sm:gap-x-[18px] gap-x-3 md:gap-y-[75px] sm:gap-y-[65px] gap-y-[40px] sm:mt-12 mt-7 mb-15">
          {filteredProducts.map((product, index) => (
            <ProductItemWithoutBTN key={index} product={product as GetSlugProduct & { defaultVariant?: string }} />
          ))}
        </div>
        {trimmedQuery && filteredProducts.length === 0 && (
          <p className="text-black text-[clamp(14px,1.6vw,16px)] mt-10 mb-15 text-center w-full">
            Nie znaleziono produktów dla frazy „{trimmedQuery}”.
          </p>
        )}
      </div>
    </Container>
  );
};

export default SearchPage;
