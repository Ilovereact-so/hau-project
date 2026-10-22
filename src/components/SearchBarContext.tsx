'use client'
import React, { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, X } from 'lucide-react'
import ResearchNav from './ResearchNav'
import {useMediaQuery} from '@/hooks/useMediaQuery'
import { useState } from 'react'
import { useProductSearch } from '@/hooks/useProductSearch'
import { urlFor } from '@/sanity/lib/image'
import Image from 'next/image'
import { DiscountBadge, OmnibusNote, PriceRow, useProductPrice } from './price/ProductPrice'
import type { ProductPromotion } from '@/lib/promotion'
import Link from 'next/link'
import { SearchOverlay } from './SearchOverlay'
import SearchPortal from './SearchPortal'
import { useRecentSearches, RecentProduct } from '@/hooks/useRecentSearches'
import { usePopularSearches } from '@/hooks/usePopularSearches'
import { useRouter } from 'next/navigation'

// Zanikanie góry scrollowanych wyników (mode 0, mobile) – ten sam trik co edgeFade
// w NavbarItems.tsx: mask-image steruje alfą, więc treść "rozpuszcza się" pod sticky
// paskiem wyszukiwania zamiast być twardo ucięta, bez przyciemniania koloru.
const RESULTS_TOP_FADE = 'linear-gradient(to bottom, transparent 0, black 28px, black 100%)'

type Props ={
    mode: number,
    isChangeMode: boolean,
    mobile: boolean,
    showSearchBar?: boolean,
    focusChanges?: VoidFunction,
    blurChanges?: VoidFunction,
    onQueryChange: (value: string) => void;
    // Zamyka cały aktywny search (rodzic w NavRMenu — chowa panel, czyści hash,
    // odblokowuje scroll). Wywoływane przez X i przez kliknięcie poza search.
    onClose?: VoidFunction;
    // Zamknięcie po ZATWIERDZENIU wyszukiwania, gdy zaraz nastąpi nawigacja na
    // /search. Osobne od onClose, bo onClose (closeSearchBar) robi history.back(),
    // co cofałoby dopiero co wypchniętą trasę — patrz komentarz przy
    // dismissSearchForNavigation w NavRMenu.tsx.
    onCommitSearch?: VoidFunction;
}

const SearchBarContext = ({mode, isChangeMode, mobile, showSearchBar, focusChanges, blurChanges, onQueryChange, onClose, onCommitSearch}: Props) => {
    //const tab  = useMediaQuery('(max-width: 1023px)');
    const xl = useMediaQuery('(max-width: 1279px)');
    const literaly_md = useMediaQuery('(max-width: 767px)');
    //const searchBarChange  = useMediaQuery('(max-width: 767px)');

    const [query, setQuery] = useState<string>("")
    const { results, loading } = useProductSearch(query)
    const md = useMediaQuery('(max-width: 920px)')
    const anchorRef = useRef<HTMLDivElement>(null)

    const { recentTerms, recentProducts, addTerm, addProduct } = useRecentSearches()
    // Fallback gdy nie ma jeszcze żadnej historii — patrz Context niżej (displayTerms).
    const { popularTerms } = usePopularSearches()
    const router = useRouter()

    const handleChange = (e: string) => {
        const value = e;

        setQuery(value);        // aktualizacja state dziecka
        onQueryChange(value);   // przekazanie do rodzica
    };

    // Zapisujemy frazę dopiero przy realnym "commitcie" (blur / klik w produkt),
    // nie na każdym keystroke'u – inaczej lista podpowiedzi zapychałaby się
    // niedokończonymi frazami typu "o", "ob", "obr"...
    const handleBlur = () => {
        blurChanges?.();
        if (query.trim().length >= 2) addTerm(query.trim());
    };

    // `product` tu bywa dwojaki: albo już-zapisany RecentProduct (klik w "ostatnio
    // oglądane", ma tylko variantKey, bez tablicy wariantów), albo świeży wynik
    // wyszukiwania (ProductSearchResult, ma tablicę `variants`, ale nigdy nie ma
    // variantKey). Bez tego fallbacku klik w wynik wyszukiwania zapisywał
    // variantKey === undefined, więc link w karcie ("Ostatnio oglądane") lądował
    // jako /product/slug?variant=undefined. Domyślnie bierzemy _key wariantu [0].
    const handleProductClick = (product: RecentProduct & { variants?: Array<{ _key: string; price: number }> }) => {
        const { variants, ...rest } = product;
        const variantKey = product.variantKey ?? variants?.[0]?._key;
        addProduct({ ...rest, variantKey });
        if (query.trim().length >= 2) addTerm(query.trim());
        // Karta produktu to <Link> — nawiguje przez history.pushState, które NIE
        // emituje "hashchange", więc listener w NavRMenu nigdy by się nie odpalił
        // i panel wyszukiwania zostałby otwarty na stronie produktu. Zamykamy go
        // tą samą ścieżką co przy submicie (bez history.back(), żeby nie cofnąć
        // nawigacji Linka).
        handleChange("");
        onCommitSearch?.();
    };

    // X i klik poza search mają całkowicie zwinąć wyszukiwanie — nie tylko
    // wyczyścić treść (bo samo wyczyszczenie query z powrotem odsłaniało
    // "ostatnio wyszukiwane" zamiast zamykać cokolwiek).
    const handleClose = () => {
        handleChange("");
        onClose?.();
    };

    // Realne wyszukiwanie — commit frazy i przejście na /search. Trzy triggery
    // (Enter w inpucie, "zatwierdź" na klawiaturze mobilnej, klik w ikonę lupy)
    // celowo idą przez jeden natywny mechanizm: <form onSubmit>. Input ma
    // type="search", więc akcja "Szukaj"/"Idź" na wirtualnej klawiaturze mobilnej
    // TO jest submit formularza — nie trzeba osobno łapać onKeyDown na Enter (to
    // by nie zadziałało tak samo na mobile). Ikona lupy staje się <button type="submit">
    // w tym samym formularzu, więc klik w nią robi dokładnie to samo co Enter.
    // q= w URL to ten sam wzorzec co "price" w SubcategoryFilterContainer —
    // zarezerwowany klucz specjalny, nie kolidujący z kluczami filtrów (te
    // pochodzą z Sanity Studio, patrz parseFiltersFromSearchParams na /search).
    // Jedno miejsce wykonania wyszukiwania — używane przez submit formularza
    // (Enter / lupa / "Szukaj" na klawiaturze mobilnej). NIE przez klik w chip
    // podpowiedzi — ten ma WPISAĆ frazę w input, a nie nawigować (handleTermClick).
    const commitSearch = (term: string) => {
        const trimmed = term.trim();
        // Ten sam próg co useProductSearch/addTerm gdzie indziej w tym pliku —
        // krótsze frazy i tak nie dają sensownych wyników.
        if (trimmed.length < 2) return;
        addTerm(trimmed);
        // Kolejność ma znaczenie: najpierw czyścimy input i zdejmujemy "#search"
        // (replaceState na BIEŻĄCYM wpisie), a dopiero potem push na /search.
        // Odwrotnie — albo gdyby zamiast onCommitSearch poleciało handleClose()
        // (czyli history.back()) — nawigacja byłaby natychmiast cofana i user
        // zostawałby na tej samej stronie.
        handleChange("");
        onCommitSearch?.();
        router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    };

    // Klik w chip "Ostatnio wyszukiwane"/"Popularne" — fraza ma WPAŚĆ do inputa
    // (panel zostaje otwarty, live-wyniki pojawiają się jak przy normalnym pisaniu),
    // a nie od razu nawigować na /search. Wcześniej podpięte było tu commitSearch,
    // które robi handleChange("") — czyli czyściło input, stąd klik w frazę
    // nigdy nie umieszczał jej w polu wyszukiwania.
    const handleTermClick = (term: string) => {
        const trimmed = term.trim();
        if (trimmed.length < 2) return;
        handleChange(trimmed);
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const trimmed = query.trim();
        // Klik w lupę bąbelkuje do rodzica (<div onClick={openSearchBar}> w
        // NavRMenu) i to jest ZAMIERZONE, gdy nie ma czego szukać — wtedy ikona
        // ma po prostu otworzyć pasek. Dlatego wychodzimy tu PRZED
        // stopPropagation: inaczej kliknięcie w lupę przy zamkniętym (pustym)
        // pasku byłoby połykane i pasek nigdy by się nie otworzył.
        if (trimmed.length < 2) return;
        // Jest realna fraza → nawigujemy. Tu propagację zatrzymujemy, żeby
        // rodzic nie otwierał panelu, który zaraz i tak zamykamy.
        e.stopPropagation();
        commitSearch(trimmed);
    };

    // Podpowiedzi = podkategorie trafionych produktów („Kategoria / Typ” + liczba),
    // każda prowadzi na swoją listę produktów (/subcategory/[slug]).
    const suggestions: Suggestion[] = []
    for (const item of results) {
        const slug = item.type?.slug
        if (!slug) continue
        const existing = suggestions.find((s) => s.slug === slug)
        if (existing) existing.count++
        else suggestions.push({ slug, label: item.path, count: 1 })
    }

    // Klik w podpowiedź: jak klik w kartę produktu — zapis frazy, zamknięcie
    // panelu (bez history.back, patrz onCommitSearch) i nawigacja.
    const handleSuggestionClick = (href: string) => {
        if (query.trim().length >= 2) addTerm(query.trim());
        handleChange("");
        onCommitSearch?.();
        router.push(href);
    };

    const resultsMask = mode === 0 && mobile
        ? { WebkitMaskImage: RESULTS_TOP_FADE, maskImage: RESULTS_TOP_FADE }
        : undefined;

    // Animacja rozsuwania paska (anchorRef, padding/border-radius) — na realnym
    // mobile 0.2s czuło się zbyt gwałtownie jak na skalę tego panelu. Ta sama
    // wartość steruje niżej opóźnieniem wjazdu narożników (search-sh/search-sh2).
    const anchorTransitionDuration = mobile ? 0.35 : 0.2;

  return (
    <motion.div  className={`h-auto sm:justify-center left-0 justify-start flex sm:ml-0 z-3 ${
        mode === 1 ? "mt-0 xl:min-w-[310px] max-w-max md:px-5 relative top-0 w-full items-center max-sm:max-w-[calc(100%-70px)] ml-4":`2xl:mt-5 mt-0 sm:items-start items-center sm:px-10 2xl:relative absolute max-sm:relative bottom-5 max-sm:top-0 max-2xl:top-21 top-0 sm:w-full rounded-[14px] max-sm:flex max-sm:flex-col max-sm:min-h-0 ${showSearchBar ? "w-full max-sm:flex-1" : "w-fit"}`
    } ${
        isChangeMode ? "max-md:top-16":""
    }`}>
        {/* Pasek (ikona + input) zostaje POZA scrollowalnym kontenerem wyników – dzięki
            temu jest zawsze widoczny na górze, a nie "sticky" w środku scrolla.
            Top padding (8px) w stanie zwiniętym (!showSearchBar) jest stałym elementem
            designu — był wcześniej warunkowany przez recentTerms.length > 0, więc znikał
            bez żadnych ostatnich wyszukiwań. Teraz zawsze obecny, niezależnie od treści.
            transform-gpu (mode 0) wymusza własną warstwę kompozytora dla anchora —
            backdrop-blur na elemencie, którego padding/border-radius framer-motion
            animuje klatka po klatce, to znany trigger na glitche w Chromium (potrafi
            na moment wyrenderować czarną klatkę zamiast rozmytego tła w trakcie
            resize'u). Jeśli "czarny skrawek" nadal wystąpi mimo tego + fade-inu
            narożników niżej, to sygnał żeby zdjąć tu backdrop-blur w trakcie animacji. */}
        <motion.div ref={anchorRef} initial={{padding:"0px", borderRadius:"35px"}} animate={showSearchBar ? {paddingInlineStart: mode === 0 ? !md ? "40px" : "20px" : !literaly_md ? "8px":"0",width: "100%", paddingInlineEnd:  mode === 0 ?  !md ? "40px" : "20px" : !literaly_md ? "8px":"0",padding: mode === 1 ?  (!literaly_md ? "8px":"0") : "8px", borderRadius:  mode === 0 ? "35px" :  "28px 28px 0px 0px"}:{padding: "8px 0px 0px 0px", borderRadius:"35px", width: "auto", paddingInlineEnd:"0px", paddingInlineStart:"0px"}} transition={{duration: anchorTransitionDuration, ease:"linear"}} className={`bg-[#D1EAE5]/85 flex flex-col  items-center max-w-full max-sm:min-w-[65vw] ${
            mode === 0 ? `backdrop-blur-[4px] transform-gpu max-sm:flex max-sm:flex-col max-sm:min-h-0 ${showSearchBar ? "max-sm:flex-1" : ""}` : "relative md:w-auto w-full"
        }`}>
            <form onSubmit={handleSubmit} className={` inline-flex space-x-5 max-w-[100%] overflow-hidden px-3 py-2    ${
            mode === 1 ? "md:border-1 border-l-1 md:border-[#838383] border-[#838383] bg-fancy-black md:h-fit h-full max-sm:w-full md:rounded-full rounded-l-full":"bg-white h-fit w-min rounded-full max-sm:shrink-0"
            }`}>
                {/* type="submit" — razem z <form onSubmit> na rodzicu i type="search" na
                    inpucie (ResearchNav/AutoResizeInput) to jeden, natywny mechanizm
                    "zatwierdzenia" wyszukiwania: Enter w inpucie, przycisk "Szukaj"/"Idź"
                    na klawiaturze mobilnej i klik w samą ikonę wszystkie trafiają w ten
                    sam handleSubmit. */}
                <button type="submit" aria-label="Szukaj" className="appearance-none bg-transparent p-0 border-0 flex items-center justify-center shrink-0 cursor-pointer">
                    <Search className={` xl:min-w-[24px] min-w-[20px] xl:min-h-[24px] min-h-[20px] ${
                        mode === 1 ? "text-white":"text-black"
                    }`}/>
                </button>
                {/**<input placeholder='Obroża taktyczna..' className='focus:outline-none font-poppins text-[16px] placeholder:text-[16px] text-black placeholder:text-[#4E4E4E]'/> */}
                <ResearchNav isMobile={mobile} mode={mode} value={query} setValue={(e)=>handleChange(e)} focusChanges={focusChanges} blurChanges={handleBlur} minWidth={!xl ? 200 : 140} maxWidth={mode === 1 && !mobile ? 320 : undefined}/>
                <X className={`cursor-pointer text-[#838383]  xl:w-[24px] w-[20px] xl:h-[24px] h-[20px] ${query ? "inline-flex" : "hidden"}`} onClick={handleClose}></X>
            </form>
            {/* Narożniki-"wcięcia" (search-sh/search-sh2, box-shadow trick, tło definiowane
                w globals.css) montowały się NATYCHMIAST razem z showSearchBar — w tej samej
                klatce co start animacji paddingu/border-radius anchora. Same nie mają
                własnego tła (tylko box-shadow), a ich bottom-0 przelicza się co klatkę
                względem wciąż zmieniającego rozmiar anchora, więc zanim layout się
                ustabilizuje potrafiło na moment przeświecić czarne tło paska nawigacji
                spod spodu. Fade-in opóźniony o anchorTransitionDuration pokazuje je
                dopiero gdy box ma już finalny rozmiar. */}
            <AnimatePresence>
                {showSearchBar && (
                    <motion.div
                        key="search-notches"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { duration: 0.15, delay: anchorTransitionDuration } }}
                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    >
                        <div className={`bottom-0 left-0 translate-x-[-100%] absolute w-[20px] h-[20px] overflow-hidden ${
                            mode === 0 ? "hidden" : "" 
                        }`}>
                            <div id="search-sh" className="w-full h-full rounded-br-[28px]"></div>
                        </div>
                        <div className={`bottom-0 right-0 translate-x-[100%] absolute w-[20px] h-[20px] overflow-hidden ${
                            mode === 0 ? "hidden" : "3lg:hidden max-md:hidden"
                        }`}>
                            <div id="search-sh2" className="w-full h-full rounded-bl-[28px]"></div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Scrollowalny kontener wyników/podpowiedzi – na mobile (mode 0) dostaje
                ograniczoną wysokość przez flex (flex-1 min-h-0), własny scroll i maskę
                zanikania na górze. Na desktopie to zwykły div bez efektu. */}
            <div
                className={mode === 0 ? "w-full max-sm:flex-1 max-sm:min-h-0 max-sm:overflow-y-auto" : ""}
                style={resultsMask}
            >
                {/* Decyzja inline-vs-portal NIE może zależeć od `query` — inaczej pierwsza
                    wpisana litera przełącza mode===1 z SearchPortal na render inline (i z
                    powrotem po wyczyszczeniu), co odmontowuje i montuje na nowo cały Context.
                    Stąd "przeładowanie" przy wpisywaniu i szarpana/urwana animacja zamykania
                    (AnimatePresence exit nie ma szans dograć, bo drzewo znika pod spodem).
                    mode===1 zawsze idzie przez portal, żeby to była jedna, stabilna instancja
                    przez cały cykl otwórz → pisz → zamknij. */}
                {mode === 0 ? (
                    <Context loading={loading} mode={mode} mobile={mobile} showSearchBar={showSearchBar} results={results} query={query} suggestions={suggestions} onSuggestionClick={handleSuggestionClick} handleChange={handleChange} recentTerms={recentTerms} recentProducts={recentProducts} popularTerms={popularTerms} onTermClick={handleTermClick} onProductClick={handleProductClick} onClose={handleClose} />
                ):(
                    <SearchPortal anchorRef={anchorRef} query={query} results={results} loading={loading} showSearchBar={showSearchBar}>
                        <Context loading={loading} mode={mode} mobile={mobile} showSearchBar={showSearchBar} results={results} query={query} suggestions={suggestions} onSuggestionClick={handleSuggestionClick} handleChange={handleChange} recentTerms={recentTerms} recentProducts={recentProducts} popularTerms={popularTerms} onTermClick={handleTermClick} onProductClick={handleProductClick} onClose={handleClose} />
                    </SearchPortal>

                )}
            </div>
      </motion.div>
    </motion.div>
  )
}


// `product` bywa albo zapisanym RecentProduct (ma tylko variantKey), albo świeżym
// wynikiem wyszukiwania (ProductSearchResult — ma `variants[]`, ale NIGDY
// variantKey). href liczy się przy renderze, PRZED kliknięciem — fallback w samym
// handleProductClick (SearchBarContext) poprawia tylko to, co się zapisze do
// localStorage na przyszłość, ale nie ten pierwszy link. Bez fallbacku tutaj klik
// w świeży wynik wyszukiwania leciał z pustym ?variant=, a strona produktu robi
// notFound() gdy variant jest pusty — czyli twarde 404 przy pierwszym kliknięciu.
const ProductCard = ({ product, mode, onClick }: { product: RecentProduct & { variants?: Array<{ _key: string; price: number }> }, mode: number, onClick?: VoidFunction }) => {
    const router = useRouter()
    const effectiveVariantKey = product?.variantKey ?? product?.variants?.[0]?._key ?? "";
    // Gdy nie da się wyznaczyć klucza wariantu, w ogóle nie doklejamy ?variant= —
    // puste wartości ("?variant=" / "?variant=undefined" ze starych wpisów w
    // localStorage bez variantKey) dawały twardy 404 na stronie produktu (ona
    // wymaga wariantu). Strona produktu sama przekieruje wtedy na pierwszy wariant.
    // Cena i Omnibus — ten sam mechanizm co kafelki (components/price/ProductPrice).
    // „Ostatnio oglądane” trzymają cenę z chwili zapisu w localStorage, więc dla
    // nich pokazujemy bieżącą cenę z rejestru, gdy jest znana.
    const priceState = useProductPrice(
        { _id: product._id, price: product.price, variants: product.variants, promotion: 'promotion' in product ? (product as { promotion?: ProductPromotion | null }).promotion ?? null : null },
        effectiveVariantKey || null,
        null,
        { preferRegistryPrice: !product.variants },
    );
    const href = effectiveVariantKey
        ? `/product/${product?.slug}?variant=${effectiveVariantKey}`
        : `/product/${product?.slug}`;
    // Nawigację bierzemy na siebie zamiast polegać na wbudowanym zachowaniu
    // next/link: obok kliknięcia w karcie lecą side-effects (zapis do historii,
    // czyszczenie inputa, zamykanie panelu), a klik musi jeszcze nie bąbelkować
    // do wrappera z onClick={openSearchBar} w NavRMenu. Kolejność w handlerze:
    // cleanup → router.push, dokładnie jak w sprawdzonej ścieżce commitSearch.
    const handleCardClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        // Modyfikatory i przyciski myszy != lewy → natywne "otwórz w nowej
        // karcie/oknie", nie ruszamy (żadnego preventDefault ani push).
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault(); // wyłącza linkClicked w next/link — nawigację robimy niżej sami
        // Klik NIE może bąbelkować do wrappera <div onClick={openSearchBar}> w
        // NavRMenu: po naszym cleanupie (panel zamknięty, #search zdjęte) taki
        // bąbelek otwierał search od nowa i wbijał pushState("#search") w środek
        // in-flight nawigacji — URL zostawał na /#search mimo 200 z serwera.
        // To samo stopPropagation ma już handleSubmit (Enter) — tu musiało być tak samo.
        e.stopPropagation();
        // Side-effects PRZED router.push — identyczna kolejność jak w działającym
        // commitSearch (Enter): najpierw czyszczenie inputa i zdjęcie #search
        // (replaceState na bieżącym wpisie historii), dopiero potem push nowej
        // trasy. Odwrotna kolejność = replaceState w trakcie trwającej nawigacji.
        onClick?.();
        router.push(href);
    };
    return (
    <Link
        href={href}
        onClick={handleCardClick}
        className="cursor-pointer flex flex-col min-w-[130px] w-auto max-sm:overflow-hidden relative max-sm:rounded-[20px] "
    >   <div className=' flex gap-x-4 w-fit'>
            {product?.images &&
                <div className='relative shrink-0'>
                    <Image src={urlFor(product.images[0]).url()} alt={String(product?.title)} width={154} height={154} className='md:w-[154px] 3xs:w-[120px] w-[80px] md:h-[154px] 3xs:h-[120px] h-[80px] opacity-90 z-1 brightness-93 object-cover rounded-[20px]'/>
                    <DiscountBadge
                        state={priceState}
                        className='absolute top-2 left-2 z-2 bg-[#e2f3f0] px-1.5 py-0.5 rounded-[8px] text-black sm:text-[12px] text-[10px] font-medium'
                    />
                </div>
            }
            <div className="w-auto flex flex-col font-poppins relative z-2 ">
                <div className="2lg:mb-2">
                    <p className="sm:text-[14px] text-[12px] text-black cursor-pointer">{product?.brand}</p>
                    <p className="sm:text-[16px] text-[14px] text-black font-medium">{product?.title}</p>
                    <p className="sm:text-[13px] text-[11px] text-black ">{product?.subtitle}</p>
                </div>
                
                <div className=''>
                    <PriceRow
                        state={priceState}
                        className='sm:text-[14px] text-[12px] gap-x-1.5'
                        priceClassName='font-medium'
                        suffix={<span className='text-[#6C6C6C] sm:text-[12px] text-[10px]'>w tym VAT</span>}
                    />
                    <OmnibusNote
                        state={priceState}
                        className='text-[#6C6C6C] text-[11px] max-md:hidden'
                        labelClassName='mt-1'
                    />
                </div>
            </div>
        </div>
    </Link>
    )
}

type Suggestion = { slug: string; label: string; count: number }

type contextProps = {
    loading: boolean,
    mode: number,
    mobile: boolean,
    showSearchBar?: boolean,
    results: any[],
    query: string,
    suggestions: Suggestion[],
    onSuggestionClick: (href: string) => void,
    handleChange: (e:string) => void,
    recentTerms: string[],
    recentProducts: RecentProduct[],
    popularTerms: string[],
    onTermClick: (term: string) => void,
    onProductClick: (product: RecentProduct) => void,
    onClose?: VoidFunction,
}
const Context = ({loading, mode, mobile, showSearchBar, results, query, suggestions, onSuggestionClick, handleChange, recentTerms, recentProducts, popularTerms, onTermClick, onProductClick, onClose}:contextProps)=>{

    const [startContentDelay,setStartContentDelay] = useState(false)
    const showRecentProducts =  showSearchBar && recentProducts.length > 0
    const literaly_md = useMediaQuery('(max-width: 767px)');
    // "Popularne" to fallback zamiast "Ostatnio wyszukiwane" — TYLKO gdy user nie ma
    // jeszcze żadnej historii. Jak tylko coś wyszuka, wraca normalna lista ostatnich.
    const hasRecentTerms = recentTerms.length > 0
    const displayTerms = hasRecentTerms ? recentTerms : mobile ? popularTerms.slice(0,3) : popularTerms
    const showTerms = displayTerms.length > 0
    const termsLabel = hasRecentTerms ? "Ostatnio wyszukiwane:" : "Popularne:"

    const showSuggestions = (showTerms || showRecentProducts)

    // Rounded box (tło/obramowanie/szerokość) i milczne tło do zamknięcia mają się
    // pokazywać TYLKO gdy faktycznie jest co pokazać — wcześniej rozjeżdżały się
    // wyłącznie na podstawie showSearchBar, więc świeżo otwarty search bez żadnych
    // ostatnich wyszukiwań i bez query pokazywał pusty, "wiszący" box bez sposobu na
    // zamknięcie klikiem obok. Górny padding (pt-3) NIE jest tym objęty w ogóle —
    // to stały element designu na mode===1, niezależny od showSearchBar/isOpen.
    const hasContent = Boolean(query) || showSuggestions;
    const isOpen = showSearchBar && hasContent;

    // Bez resetu w gałęzi "else" ten stan raz ustawiony na true już taki zostawał
    // (komponent zwykle NIE odmontowuje się między otwarciami — patrz showSearchBar
    // w propsach, nie remount). Efekt fade-in był więc widoczny tylko przy pierwszym
    // otwarciu w całej sesji strony; przy kolejnych startContentDelay było już true
    // i treść wskakiwała bez opóźnienia. Dodatkowo brak sprzątania timera pozwalał
    // szybkiemu zamknięciu przed upływem 200ms i tak ustawić true "po fakcie".
    useEffect(()=>{
        if(showSearchBar){
            const timer = setTimeout(()=>{
                setStartContentDelay(true)
            }, 200)
            return () => clearTimeout(timer)
        }
        setStartContentDelay(false)
    },[showSearchBar])

    // preventDefault na mousedown: klik w cokolwiek wewnątrz panelu (wynik,
    // chip, "ostatnio oglądane") NIE może ściągać focusa z inputa. Blur na
    // mousedown odpalał addTerm → nowy chip na początku listy przestawiał
    // layout w trakcie kliknięcia (między mousedown a mouseup), przez co
    // click lądował na kontenerze zamiast na <a> karty — nawigacja nie
    // zachodziła, mimo że hover-prefetch w terminalu wyglądał jak przejście.
    // Bez blur-reakcji layout w trakcie kliknięcia jest stabilny. Input
    // (poza Context) klika się normalnie.
    return(
        <div
            onMouseDown={(e) => e.preventDefault()}
            className={`${
                mode == 1 ? "3lg:absolute 3lg:max-w-[calc(100vw-200px)]  items-center top-[100%] right-0 bg-[#D1EAE5]/95 backdrop-blur-[2px] ease-in-out duration-200 flex flex-col ":"max-md:max-h-[calc(100vh-190px)] max-md:overflow-y-auto max-md:overflow-x-hidden search-scroll-container"
                } ${
                    mode == 1 ? !isOpen ? "min-w-[calc(100%-20px)] 3lg:w-max  opacity-0" : "rounded-[35px] 3lg:min-w-[calc(100%+40px)] 3lg:w-max w-full 3lg:rounded-tr-[0px] md:px-6 px-5 py-4 opacity-100" : "w-auto "
                }`}>
                {/* Backdrop do zamknięcia klikiem "poza search" — montuje się razem z boxem
                    (isOpen), więc nigdy nie ma stanu "widoczny pusty box bez sposobu na
                    zamknięcie kliknięciem obok". */}
                {isOpen && (
                    <SearchOverlay onClose={onClose ?? (() => handleChange(""))} />
                )}
                <div className='flex max-md:flex-col w-full'>
                    <div className='flex flex-col w-auto'>
                        <AnimatePresence>
                        {((showSuggestions && mobile) || (showSuggestions && showSearchBar)) && showTerms && (
                            <motion.div initial={{opacity:0, height:"0px",width:"20px"}} animate={{ opacity: startContentDelay || mobile? 1 : 0, height:"auto",width:"100%"}} exit={{opacity:0, height:"0px", width:"20px"}} className={`z-10 w-full overflow-hidden `}>
                                    <div className='flex flex-col p-2 pb-3 px-3 pt-4 font-poppins'>
                                        <p className={` text-black font-medium ${
                                            mode === 1 ? "text-[clamp(14px,1.6vw,15px)]":"text-[clamp(14px,1.6vw,16px)]"
                                        }`}>{termsLabel}</p>
                                        <div className='flex flex-wrap max-sm:max-w-[60vw] gap-2 mt-2'>
                                            {displayTerms.map((term) => (
                                                <button
                                                    key={term}
                                                    type="button"
                                                    onClick={() => onTermClick(term)}
                                                    className={`text-black bg-white/70 hover:bg-white transition-colors rounded-full px-3 py-1 ${
                                                        mode === 1 ? "text-[clamp(12px,1.6vw,14px)]":"text-[clamp(14px,1.6vw,16px)]"
                                                    }`}
                                                >
                                                    {term}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                            </motion.div>
                        )}
                        </AnimatePresence>

                        <AnimatePresence>
                                {query && !loading && showSearchBar && results.length != 0 &&
                                    <motion.div initial={{opacity:0, height:"0px"}} animate={{ opacity:1, height:"auto"}} exit={{opacity:0, height:"0px"}} className='flex w-full overflow-hidden'>
                                        <div className='flex flex-col p-2 pt-4 font-poppins w-full'>
                                            <p className={` text-black font-medium ${
                                                mode === 1 ? "text-[clamp(12px,1.6vw,14px)]":"text-[clamp(14px,1.6vw,16px)]"
                                            }`}>Podpowiedzi wyszukiwania:</p>
                                            <div className='flex flex-col mt-2 px-4 w-full 2md:text-nowrap 2md:space-y-1 space-y-2'>
                                                {suggestions.map((suggestion) => {
                                                    const href = `/subcategory/${encodeURIComponent(suggestion.slug)}`
                                                    return (
                                                        <Link
                                                            key={suggestion.slug}
                                                            href={href}
                                                            onClick={(e) => {
                                                                // Jak w ProductCard: modyfikatory = natywne „nowa karta”,
                                                                // lewy klik — sprzątanie panelu i nawigacja u rodzica.
                                                                // stopPropagation: bez tego klik bąbelkuje do
                                                                // onClick={openSearchBar} w NavRMenu i otwiera search od nowa.
                                                                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                onSuggestionClick(href);
                                                            }}
                                                            className={`group text-black gap-x-4 flex justify-start items-center py-0.5 ${
                                                                mode === 1 ? "text-[clamp(12px,1.6vw,14px)]":"text-[clamp(14px,1.6vw,16px)]"
                                                            }`}
                                                        >
                                                            <span className='min-w-[1.5ch] text-[#6C6C6C] tabular-nums'>{suggestion.count}</span>
                                                            <span className='group-hover:underline underline-offset-2'>{suggestion.label}</span>
                                                        </Link>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </motion.div>
                                }
                        </AnimatePresence>
                    </div>
                    <AnimatePresence>
                        {query.length > 1 &&  showSearchBar &&
                            <motion.div initial={{opacity:0, height:"0px", width:"0%"}} animate={{ opacity:1, height:"auto", width:"100%"}} exit={{opacity:0, height:"0px", width:"0px"}} className="z-10 overflow-hidden font-poppins">
                                {loading && (
                                    <motion.div initial={{opacity:0}} animate={{ opacity:1}} className={`p-3 text-sm text-[#4c8e8e] ${
                                        mode === 1 && "w-full"
                                    }`}>Searching...</motion.div>
                                )}

                                {!loading && results.length === 0 && query.length > 1 && (
                                    <motion.div initial={{height:0, padding:0}} animate={{ height:"auto", padding:"12px"}} className="p-3 text-sm text-[#4c8e8e] overflow-hidden">
                                    Nie znaleziono produktu
                                    </motion.div>
                                )}

                                
                                {!loading && results.length != 0 && showSearchBar &&
                                <motion.div initial={{opacity:0, height:"0px", margin:"0px", padding:"0px", width:"100%"}} animate={{ opacity:1, height:"auto", margin:"8px 0 0 0", padding: mobile ? "0" : "20px 24px", width:"100%"}} exit={{opacity:0, height:"0px", margin:"0px", padding:"0px",width:"0px"}} className='flex bg-[#fbfbfb] rounded-[40px] overflow-hidden'>
                                    <div className='flex flex-col w-full md:overflow-auto md:h-[calc(100vh-200px)] h-auto space-y-4 pr-3 rounded-[20px] search-scroll-container max-md:px-3 max-md:py-3'>
                                        {results.slice(0,5).map((product) => (
                                            <ProductCard key={product._id} product={product} mode={mode} onClick={() => onProductClick(product)} />
                                        ))}
                                    </div>
                                </motion.div>
                                }
                            </motion.div>
                        }
                    </AnimatePresence>
                </div>
                <AnimatePresence>
                    {/* mode 0: szerokość NIE jest animowana. Wcześniej leciało tu
                        20px → "" (pusty string). Framer nie umie interpolować do "",
                        więc przed startem mierzył docelową szerokość (w-fit = max-content
                        dwóch kart obok siebie) i przez cały czas animacji trzymał na
                        elemencie JAWNĄ wartość w px. W przeciwieństwie do w-fit/100%
                        (które są przycinane do dostępnego miejsca) stała wartość w px wchodzi do
                        intrinsic size przodków — anchor → wrapper → NavRMenu → grid
                        navbara — więc cały navbar rozjeżdżał się o kilkanaście px, a po
                        końcu animacji (powrót do "" → w-fit) wracał. Teraz w mode 0
                        szerokość zostaje wyłącznie w CSS (w-fit + max-w-full + min-w-0),
                        a animujemy tylko opacity/height. mode 1 bez zmian. */}
                    {((showSuggestions && mobile) || (showSuggestions && showSearchBar)) && (showRecentProducts && results.length == 0) && (
                        <motion.div
                            initial={mode === 1 ? {opacity:0, height:"0px", width: !literaly_md ? "20px" : undefined} : {opacity:0, height:"0px"}}
                            animate={mode === 1 ? { opacity:startContentDelay ? 1: 0, height:"auto", width:"100%"} : { opacity:startContentDelay ? 1: 0, height:"auto"}}
                            exit={mode === 1 ? {opacity:0, height:"0px", width: !literaly_md ? "20px" : undefined} : {opacity:0, height:"0px"}}
                            className={`z-10 max-md:w-full w-fit overflow-hidden ${mode === 0 ? "max-w-full min-w-0" : ""}`}>
                            
                        <div  className='flex flex-col p-2 pt-2 font-poppins w-fit overflow-hidden'>
                            <p className='text-black font-medium text-[clamp(14px,1.6vw,15px)] w-full'>Ostatnio oglądane:</p>
                            <div id='recent-products-scroll' className={`grid md:grid-cols-2 md:gap-x-4 max-md:gap-y-4 mt-3 w-fit overflow-hidden `}>
                                {recentProducts.slice(0,2).map((product) => (
                                    <ProductCard key={product._id} product={product} mode={mode} onClick={() => onProductClick(product)} />
                                ))}
                            </div>
                        </div>
                            
                        </motion.div>
                    )}
                </AnimatePresence>
        </div>

    )
}

export default SearchBarContext
