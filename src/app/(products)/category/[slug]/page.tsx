import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { getCategoryBySlug, getProductsByCategory, type SubcategoryWithCategory } from "@/sanity/helpers";
import type { GetSlugProduct } from "../../../../../sanity.types";
import SortSelect from "@/components/SortSelect";
import ProductItemWithoutBTN from "@/components/ProductItemWithoutBTN";
import ListingFilterEmpty, { LISTING_GRID_CLASS, listingHrefWithoutFilters } from "@/components/ListingFilterEmpty";
import SubcategoryFilterContainer from "@/components/SubcategoryFilterContainer";
import Container from "@/components/Container";
import ListingSeoContent from "@/components/ListingSeoContent";
import { parseProductSort } from "@/lib/productSort";
import { sortProductsForListing } from "@/lib/productListing";
import { filterListingProducts, listingPriceBounds, parseListingParams } from "@/lib/listingFilters";
import { breadcrumbJsonLd, jsonLdScript, pageMetadata } from "@/lib/seo/metadata";
import { isProductCategory } from "@/lib/categoryNavigation";

/*
 * Strona kategorii głównej (Zabawki, Przysmaki…) — klik w nazwę kategorii
 * w menu. Pokazuje produkty ze WSZYSTKICH podkategorii (i przypisane wprost
 * do kategorii), skróty do podkategorii, te same filtry/sortowanie co
 * subkategoria i długi opis SEO na dole strony.
 */

type PageProps = {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const category = await getCategoryBySlug(slug);
    if (!category || !isProductCategory(category)) return { title: "Nie znaleziono kategorii" };
    const hasParams = Object.keys(await searchParams).length > 0;
    return pageMetadata({
        title: category.metaTitle || category.title,
        description:
            category.metaDescription ||
            category.description ||
            `${category.title} dla psa w sklepie HAU — sprawdź ceny, opinie i dostępność.`,
        path: `/category/${slug}`,
        index: !hasParams,
    });
}

const CategoryPage = async ({ params, searchParams }: PageProps) => {
    const { slug } = await params;
    const category = await getCategoryBySlug(slug);
    // Poradniki itp. (NON_PRODUCT_CATEGORY_SLUGS) nie są kategorią sklepu.
    if (!category || !isProductCategory(category)) notFound();

    const products = (await getProductsByCategory(category._id)) as GetSlugProduct[];

    // Filtry kategorii = suma filtrów jej podkategorii (bez duplikatów).
    const filterMap = new Map<string, NonNullable<SubcategoryWithCategory["availableFilters"]>[number]>();
    for (const sub of category.subcategories) {
        for (const filter of sub.availableFilters ?? []) {
            if (filter?._id && !filterMap.has(filter._id)) filterMap.set(filter._id, filter);
        }
    }
    const availableFilters = [...filterMap.values()];
    const details: SubcategoryWithCategory = {
        _id: category._id,
        title: category.title,
        slug: category.slug,
        description: category.description ?? "",
        availableFilters,
        imageWithAlt: { asset: { _ref: "" }, alt: "" },
        category: { _id: category._id, title: category.title, slug: category.slug },
    };

    const resolved = await searchParams;
    const sort = parseProductSort(resolved.sort);
    const listingParams = parseListingParams(resolved);
    const filterIds = new Map(availableFilters.map((f) => [f.key, f._id]));
    const filteredProducts = await sortProductsForListing(
        filterListingProducts(products, listingParams, filterIds),
        sort,
    );
    const priceBounds = listingPriceBounds(products);
    // Filtry nic nie zostawiły — pokazujemy resztę kategorii pod komunikatem.
    const noFilterMatches = filteredProducts.length === 0 && products.length > 0;
    const restProducts = noFilterMatches ? await sortProductsForListing(products, sort) : [];
    const initialMobile = (await headers()).get("x-is-mobile") === "1";
    const breadcrumb = breadcrumbJsonLd([
        { name: "Strona główna", path: "/" },
        { name: category.title, path: `/category/${slug}` },
    ]);

    return (
        <>
            <script {...jsonLdScript(breadcrumb)} />
            <Container id="sub-category-container" className="flex justify-center lg:mt-10 md:mt-7 sm:mt-10 mt-7 md:px-10 sm:px-8 px-6 min-h-[100vh] font-poppins">
                <div className="flex flex-col h-full w-auto relative">
                    <div className="flex w-full relative z-[3]">
                        <div className="flex flex-col space-y-1">
                            <nav aria-label="Ścieżka" className="flex items-center space-x-2 text-black text-[clamp(14px,1.4vw,16px)]">
                                <Link href="/" className="hover:underline underline-offset-2">Sklep</Link>
                                <ChevronRight className="w-[20px] h-[20px]" aria-hidden="true" />
                                <span>{category.title}</span>
                            </nav>
                            <h1 className="font-medium text-black sm:text-[clamp(18px,2vw,26px)] text-[16px]">
                                {category.description || category.title}
                            </h1>
                        </div>
                    </div>

                    {category.subcategories.length > 0 && (
                        <nav aria-label="Podkategorie" className="flex flex-wrap gap-2 mt-5">
                            {category.subcategories.map((sub) => (
                                <Link
                                    key={sub._id}
                                    href={`/subcategory/${sub.slug}`}
                                    className="rounded-full border border-black/20 bg-white px-4 py-[7px] text-[clamp(13px,1.2vw,15px)] text-black hover:bg-main hover:border-main transition-colors"
                                >
                                    {sub.title}
                                </Link>
                            ))}
                        </nav>
                    )}

                    <div className="flex justify-center w-full mt-[clamp(26px,6vw,60px)]">
                        <div className="flex subcategory-dock-shadow relative bg-fancy-black md:py-2 xs:py-3 py-2 md:pt-4 md:px-9 3xs:px-7 xs:px-4 px-3 rounded-full lg:w-[65vw] 2md:w-[70vw] w-[80vw] z-[1] min-h-[50px] max-w-[1350px]">
                            <div className="w-full flex justify-between">
                                <div className="flex flex-col w-full z-[3] relative space-y-2 pr-4">
                                    <p className="text-white text-[clamp(16px,1.4vw,18px)] ml-1 max-md:hidden">Filtruj:</p>
                                    <SubcategoryFilterContainer
                                        subcategoryDetails={details}
                                        products={products}
                                        paramsFilter={listingParams.options}
                                        priceBounds={priceBounds}
                                        priceRange={{ min: listingParams.priceMin, max: listingParams.priceMax }}
                                        initialMobile={initialMobile}
                                    />
                                </div>
                                <div className="flex md:flex-col flex-row-reverse md:space-y-2 h-fit relative z-[3]">
                                    <div className="flex items-center 3xs:px-4 px-2">
                                        <p className="text-white text-[clamp(16px,1.4vw,18px)] max-md:hidden">Sortuj:</p>
                                    </div>
                                    <SortSelect value={sort} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {filteredProducts.length > 0 ? (
                        <div className={`${LISTING_GRID_CLASS} sm:mt-12 mt-7 mb-15`}>
                            {filteredProducts.map((product) => (
                                <ProductItemWithoutBTN key={product._id} product={product as GetSlugProduct & { defaultVariant?: string }} />
                            ))}
                        </div>
                    ) : noFilterMatches ? (
                        <ListingFilterEmpty
                            products={restProducts as Array<GetSlugProduct & { defaultVariant?: string }>}
                            clearHref={listingHrefWithoutFilters(`/category/${slug}`, resolved)}
                            scope="z tej kategorii"
                        />
                    ) : (
                        <p className="text-[#6C6C6C] text-[clamp(14px,1.4vw,16px)] sm:mt-12 mt-7 mb-20">
                            W tej kategorii nie ma jeszcze produktów.
                        </p>
                    )}
                    <ListingSeoContent value={category.seoContent} title={category.title} />
                </div>
            </Container>
        </>
    );
};

export default CategoryPage;
