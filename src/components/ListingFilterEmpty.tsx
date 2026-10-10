import Link from "next/link";
import { SearchX } from "lucide-react";
import type { GetSlugProduct } from "sanity.types";
import ProductItemWithoutBTN from "@/components/ProductItemWithoutBTN";

/*
 * Stan „żaden produkt nie pasuje do wybranych filtrów” na listingach
 * (subkategoria, kategoria, wyszukiwarka). Zamiast pustej strony:
 * komunikat po lewej, link „Wyczyść filtry” i pod spodem pozostałe produkty
 * z tej samej listy (bez filtrów, w wybranej kolejności sortowania) —
 * klient od razu ma co oglądać, a nie musi cofać filtrów po omacku.
 */

/** Siatka produktów listingu — te same klasy co na stronach listingów. */
export const LISTING_GRID_CLASS =
    "grid justify-items-center 2.5xl:grid-cols-4 lg:grid-cols-4 sm:grid-cols-3 grid-cols-2 sm:gap-x-[18px] gap-x-3 md:gap-y-[75px] sm:gap-y-[65px] gap-y-[40px]";

/**
 * Adres listy bez filtrów: zostają tylko parametry, które filtrami nie są
 * (sortowanie, fraza wyszukiwania).
 */
export function listingHrefWithoutFilters(
    path: string,
    searchParams: Record<string, string | string[] | undefined>,
    keep: string[] = ["sort"],
): string {
    const params = new URLSearchParams();
    for (const key of keep) {
        const value = searchParams[key];
        const first = Array.isArray(value) ? value[0] : value;
        if (first) params.set(key, first);
    }
    const query = params.toString();
    return query ? `${path}?${query}` : path;
}

export default function ListingFilterEmpty({
    products,
    clearHref,
    scope,
}: {
    /** Cała lista (bez filtrów), już posortowana. */
    products: Array<GetSlugProduct & { defaultVariant?: string }>;
    /** Adres tej samej listy bez filtrów. */
    clearHref: string;
    /** Dopowiedzenie do nagłówka, np. „z tej podkategorii”. */
    scope: string;
}) {
    return (
        <section aria-live="polite" className="sm:mt-12 mt-7 mb-15 w-full">
            <div className="flex items-start gap-4 max-w-[640px]">
                <div className="hidden xs:flex shrink-0 items-center justify-center w-[48px] h-[48px] rounded-full bg-[#e2f3f0]">
                    <SearchX className="w-[22px] h-[22px] text-[#6EB0A6]" aria-hidden="true" />
                </div>
                <div className="flex flex-col items-start">
                    <p className="font-medium text-black text-[clamp(16px,1.6vw,20px)]">
                        Żaden produkt nie pasuje do wybranych filtrów.
                    </p>
                    <p className="text-[#6C6C6C] text-[clamp(13px,1.3vw,15px)] mt-1">
                        Zmień lub wyczyść filtry albo zajrzyj do pozostałych produktów poniżej — może coś przypadnie Twojemu psu do gustu.
                    </p>
                    <Link
                        href={clearHref}
                        scroll={false}
                        className="mt-4 inline-flex items-center rounded-full bg-fancy-black text-white px-6 py-2 text-[clamp(14px,1.3vw,15px)] font-medium hover:bg-black ease-in-out duration-200"
                    >
                        Wyczyść filtry
                    </Link>
                </div>
            </div>

            {products.length > 0 && (
                <>
                    <h2 className="font-medium text-black text-[clamp(17px,1.8vw,22px)] md:mt-16 mt-12">
                        Sprawdź inne produkty {scope}
                    </h2>
                    <div className={`${LISTING_GRID_CLASS} sm:mt-8 mt-5`}>
                        {products.map((product) => (
                            <ProductItemWithoutBTN key={product._id} product={product} />
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}
