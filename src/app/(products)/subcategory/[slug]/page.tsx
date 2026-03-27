import React from "react";
import { notFound } from "next/navigation";
import { getProductsBySubCategory, getSubCategoryBySlug, SubcategoryWithCategory } from "@/sanity/helpers";
import { GetSlugProduct, Product, Subcategory } from "../../../../../sanity.types";
import { ArrowDown, ChevronRight } from "lucide-react";
import Image from "next/image";
import ProductItem from "@/components/ProductItem";
import ProductItemWithoutBTN from "@/components/ProductItemWithoutBTN";
import SubcategoryFilterContainer from "@/components/SubcategoryFilterContainer";

const SubCategoryProductPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) => {
    const { slug} = await params;
    const products = await getProductsBySubCategory(slug) as GetSlugProduct[];
    if (!products) {
        return notFound();
      }
    
    function parseFiltersFromSearchParams(
        searchParams: Record<string, string | string[] | undefined>
        ) {
        const result: Record<string, string[]> = {}

        Object.entries(searchParams).forEach(([key, value]) => {
            if (!value) return

            result[key] = Array.isArray(value)
            ? value
            : [value]
        })

        return result
    }


    function extractPriceFilter(filters: Record<string, string[]>) {
        const { price, ...optionFilters } = filters

        const maxPrice = price?.[0] ? Number(price[0]) : null

        return {
            maxPrice,
            optionFilters,
        }
    }
    type Filters = Record<string, string[]>

function filterProductsByVariantOptions(
    products: GetSlugProduct[],
    filters: Filters
    ): (GetSlugProduct & { defaultVariant?: string })[] {
    if (Object.keys(filters).length === 0) return products

    const { maxPrice, optionFilters } = extractPriceFilter(filters)

    return products.reduce<(GetSlugProduct & { defaultVariant?: string })[]>(
        (acc, product) => {
        if (!product.variants?.length) return acc

        const matchingVariant = product.variants.find(variant => {
            // 💰 price filter
            if (maxPrice !== null && variant.price != null &&variant.price > maxPrice) {
            return false
            }

            // 🎛 option filters (color, size, etc.)
            return Object.entries(optionFilters).every(
            ([filterKey, filterValues]) =>
                variant.optionValues?.some(ov =>
                ov.name?.key === filterKey && ov.value?.slug?.current && 
                filterValues.includes(ov.value?.slug?.current)
                )
            )
        })

        if (!matchingVariant) return acc

        acc.push({
            ...product,
            defaultVariant: matchingVariant._key,
        })

        return acc
        },
        []
    )
    }


    const filters = parseFiltersFromSearchParams(await searchParams)
    const subCategoryDetails = await getSubCategoryBySlug(slug) as SubcategoryWithCategory;
    const filteredProducts = filterProductsByVariantOptions(products, filters)
    console.log("Products in Subcategory:", products);
    return(
        <div id="sub-category-container" className="flex justify-center mt-10 md:px-10 sm:px-8 px-6 min-h-[100vh]">
            <div className="flex flex-col h-full w-full max-w-[1600px] relative">
                <div className="flex w-full relative z-[3]">
                    <div className="flex flex-col space-y-1">
                        <div className="flex items-center space-x-2">
                            <h1 className="text-black  text-[clamp(14px,1.4vw,16px)]">{subCategoryDetails?.category?.title}</h1>
                            <ChevronRight className="text-black w-[20px] h-[20px]"/>
                            <h1 className="text-black  text-[clamp(14px,1.4vw,16px)]">{subCategoryDetails?.title}</h1>
                        </div>
                        <h1 className="font-medium text-black text-[clamp(18px,2vw,26px)]">{subCategoryDetails?.description}</h1>
                    </div>
                </div>
                <div className="flex justify-center w-full mt-[clamp(30px,8vw,80px)]">
                    <div className="flex subcategory-dock-shadow relative bg-fancy-black md:py-2 xs:py-3 py-2 md:pt-4 md:px-9 3xs:px-7 xs:px-5 px-4 rounded-full lg:w-[65vw] 2md:w-[70vw] w-[80vw] z-[1] min-h-[50px] max-w-[1350px]">
                        <Image className="w-[clamp(300px,33vw,400px)] absolute bottom-[0] xl:left-[-200px] lg:left-[-15vw] 2md:left-[-12vw] left-[-8vw] z-[2] opacity-80" src='/white-holo.png' alt="white-holo" width={460} height={330}/>
                        <div className="w-full flex justify-between">
                            <div className="flex flex-col w-full z-[3] relative space-y-2 pr-4">
                                <h1 className="text-white text-[clamp(16px,1.4vw,18px)] ml-1 max-md:hidden">Filtruj:</h1>                            
                                <SubcategoryFilterContainer subcategoryDetails={subCategoryDetails} products={products} paramsFilter={filters}/>
                            </div>
                            <div className="flex md:flex-col flex-row-reverse md:space-y-2 h-fit relative z-[3]">
                                <div className="flex items-center justify-between 3xs:px-4 px-2">
                                    <h1 className="text-white text-[clamp(16px,1.4vw,18px)] max-md:hidden">Sortuj:</h1>
                                    <ArrowDown className="text-white w-[20px] h-[20px]"/>
                                </div>
                                <div className="xs:text-[clamp(15px,1.4vw,17px)] text-[14px] text-black bg-white 3xs:px-8 px-6 py-2 h-fit rounded-[20px] font-medium">Popularne</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="3xs:grid flex max-3xs:flex-wrap justify-center gap-y-8 3xl:gap-x-5 max-3xl:gap-x-5 max-1xl:gap-x-5 justify-items-center 3xl:grid-cols-[repeat(5,290px)] max-3xl:grid-cols-[repeat(auto-fit,290px)] max-1xl:grid-cols-[repeat(auto-fit,230px)] max-lg:grid-cols-[repeat(auto-fit,200px)] mt-12 mb-15">
                    {filteredProducts.map((product, index)=>(
                        <ProductItemWithoutBTN key={index} product={product as GetSlugProduct & { defaultVariant?: string }}/>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default SubCategoryProductPage;