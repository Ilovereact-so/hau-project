import ContentContainer from "@/components/ContentContainer";
import Footer from "@/components/Footer";
import HomeCarousel from "@/components/HomeCarousel";
import { getAllCollections } from "@/sanity/helpers";
import type { Metadata } from "next";
import { jsonLdScript, organizationJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    path: "/",
    absoluteTitle: true,
});
/**
 * Strona główna — TERAZ server component.
 *
 * Wcześniej cały plik był 'use client' i pobierał banery w useEffect po
 * hydratacji (getAllBaners z clientRequest.ts) — user przez pierwsze ~2-5 s po
 * odświeżeniu widział pusty hero, dopóki przeglądarka nie dociągnęła JS-a i
 * danych z Sanity. Teraz banery lecą z serwera (sanityFetch + cache Next) i
 * są w pierwszym renderze HTML jako propsy dla klientowej karuzeli.
 * Pozostałe moduły (karuzele produktów, subkategorie, poradniki) nadal są
 * komponentami klienckimi — dostają dane przez cache/dedup z clientRequest.ts
 * i pokazują skeletony na czas ładowania.
 */
export default async function Home() {

    const collections = (await getAllCollections()).filter((c) => c.productCount > 0);
    return (
        <div className="">
            {/* Dane firmy i wyszukiwarki dla Google — raz, na stronie głównej. */}
            <script {...jsonLdScript(organizationJsonLd())} />
            <HomeCarousel collections={collections} />
            <ContentContainer/>
            <Footer/>
        </div>
    );
}