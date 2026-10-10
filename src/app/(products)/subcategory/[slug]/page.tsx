import React from "react";
import { notFound } from "next/navigation";
import { getProductsBySubCategory, getSubCategoryBySlug, SubcategoryWithCategory } from "@/sanity/helpers";
import { GetSlugProduct } from "../../../../../sanity.types";
import { ChevronRight } from "lucide-react";
import SortSelect from "@/components/SortSelect";
import { parseProductSort } from "@/lib/productSort";
import { sortProductsForListing } from "@/lib/productListing";
import Link from "next/link";
import ListingSeoContent from "@/components/ListingSeoContent";
import { filterListingProducts, listingPriceBounds, parseListingParams } from "@/lib/listingFilters";
import ProductItemWithoutBTN from "@/components/ProductItemWithoutBTN";
import SubcategoryFilterContainer from "@/components/SubcategoryFilterContainer";
import Container from "@/components/Container";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { breadcrumbJsonLd, jsonLdScript, pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>
    searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
    const { slug } = await params
    const details = (await getSubCategoryBySlug(slug)) as SubcategoryWithCategory | null
    if (!details) return { title: "Nie znaleziono kategorii" }

    // Listing z filtrami albo innym sortowaniem to ta sama oferta w innej
    // kolejności — kanoniczny jest czysty adres, a wersje z parametrami
    // dostają `noindex, follow` (robot i tak przejdzie do produktów).
    const hasParams = Object.keys(await searchParams).length > 0
    const title = details.category?.title ? `${details.title} — ${details.category.title}` : details.title
    return pageMetadata({
        title: details.metaTitle || title,
        description: details.metaDescription || details.description || `${details.title} w sklepie HAU. Sprawdź ceny, opinie i dostępność.`,
        path: `/subcategory/${slug}`,
        index: !hasParams,
    })
}

const SubCategoryProductPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) => {
    const { slug} = await params;
    // Oba zapytania są niezależne (produkty w subkategorii + jej metadane),
    // więc lecą równolegle — sekwencyjne await potrafiło podwoić czas oczekiwania
    // na wolniejszym łączu do Sanity.
    const [products, subCategoryDetails] = await Promise.all([
        getProductsBySubCategory(slug) as Promise<GetSlugProduct[]>,
        getSubCategoryBySlug(slug) as Promise<SubcategoryWithCategory>,
    ]);
    if (!subCategoryDetails) {
        return notFound();
    }
    
    const resolvedSearchParams = await searchParams
    const sort = parseProductSort(resolvedSearchParams.sort)
    // Filtry (opcje + cena „od – do”) — wspólna logika z kategorią i wyszukiwarką.
    const listingParams = parseListingParams(resolvedSearchParams)
    const filterIds = new Map((subCategoryDetails?.availableFilters ?? []).map((f) => [f.key, f._id]))
    const filteredProducts = await sortProductsForListing(
        filterListingProducts(products, listingParams, filterIds),
        sort,
    )
    const priceBounds = listingPriceBounds(products)
    // Podpowiedź z middleware (User-Agent), ten sam mechanizm co w NavbarContainer —
    // żeby SubcategoryFilterContainer od razu na pierwszym renderze (SSR + pierwsza
    // hydracja) wiedział czy jest mobile, zamiast zakładać desktop i dopiero po
    // zamontowaniu (realny matchMedia) przełączać się na mobile. Bez tego panel
    // filtrów renderował się w wersji desktopowej i wychodził poza zaokrągloną
    // pigułkę, zanim się "zorientował", że jest wąsko.
    const initialMobile = (await headers()).get('x-is-mobile') === '1'
    const breadcrumb = breadcrumbJsonLd([
        { name: "Strona główna", path: "/" },
        ...(subCategoryDetails?.category?.title
            ? [{ name: subCategoryDetails.category.title, path: subCategoryDetails.category.slug ? `/category/${subCategoryDetails.category.slug}` : `/subcategory/${slug}` }]
            : []),
        { name: subCategoryDetails?.title ?? "", path: `/subcategory/${slug}` },
    ])

    return(
        <>
        <script {...jsonLdScript(breadcrumb)} />
        <Container id="sub-category-container" className="flex justify-center lg:mt-10 md:mt-7 sm:mt-10 mt-7 md:px-10 sm:px-8 px-6 min-h-[100vh] font-poppins">
            <div className="flex flex-col h-full w-auto relative">
                <div className="flex w-full relative z-[3]">
                    <div className="flex flex-col space-y-1">
                        <div className="flex items-center space-x-2">
                            {subCategoryDetails?.category?.slug ? (
                                <Link href={`/category/${subCategoryDetails.category.slug}`} className="text-black text-[clamp(14px,1.4vw,16px)] hover:underline underline-offset-2">{subCategoryDetails.category.title}</Link>
                            ) : (
                                <span className="text-black  text-[clamp(14px,1.4vw,16px)]">{subCategoryDetails?.category?.title}</span>
                            )}
                            <ChevronRight className="text-black w-[20px] h-[20px]"/>
                            <span className="text-black  text-[clamp(14px,1.4vw,16px)]">{subCategoryDetails?.title}</span>
                        </div>
                        <h1 className="font-medium text-black sm:text-[clamp(18px,2vw,26px)] text-[16px]">{subCategoryDetails?.description}</h1>
                    </div>
                </div>
                <div className="flex justify-center w-full mt-[clamp(30px,8vw,80px)]">
                    <div className="flex subcategory-dock-shadow relative bg-fancy-black md:py-2 xs:py-3 py-2 md:pt-4 md:px-9 3xs:px-7 xs:px-4 px-3 rounded-full lg:w-[65vw] 2md:w-[70vw] w-[80vw] z-[1] min-h-[50px] max-w-[1350px]">
                        <div className="w-full flex justify-between">
                            <div className="flex flex-col w-full z-[3] relative space-y-2 pr-4">
                                <h1 className="text-white text-[clamp(16px,1.4vw,18px)] ml-1 max-md:hidden">Filtruj:</h1>                            
                                <SubcategoryFilterContainer subcategoryDetails={subCategoryDetails} products={products} paramsFilter={listingParams.options} priceBounds={priceBounds} priceRange={{ min: listingParams.priceMin, max: listingParams.priceMax }} initialMobile={initialMobile}/>
                            </div>
                            <div className="flex md:flex-col flex-row-reverse md:space-y-2 h-fit relative z-[3]">
                                <div className="flex items-center 3xs:px-4 px-2">
                                    <h1 className="text-white text-[clamp(16px,1.4vw,18px)] max-md:hidden">Sortuj:</h1>
                                    
                                </div>
                                <SortSelect value={sort} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="grid justify-items-center 2.5xl:grid-cols-4 lg:grid-cols-4 sm:grid-cols-3 grid-cols-2 sm:gap-x-[18px] gap-x-3 md:gap-y-[75px] sm:gap-y-[65px] gap-y-[40px] sm:mt-12 mt-7 mb-15">
                    {filteredProducts.map((product, index)=>(
                        <ProductItemWithoutBTN key={index} product={product as GetSlugProduct & { defaultVariant?: string }}/>
                    ))}
                </div>
                {filteredProducts.length === 0 && (
                    <p className="text-center text-[#6C6C6C] text-[clamp(14px,1.4vw,16px)] mb-20">
                        {products.length ? "Żaden produkt nie pasuje do wybranych filtrów." : "W tej kategorii nie ma jeszcze produktów."}
                    </p>
                )}
                <ListingSeoContent value={subCategoryDetails?.seoContent} title={subCategoryDetails?.title} />
            </div>
        </Container>
        </>
    )
}

export default SubCategoryProductPage;