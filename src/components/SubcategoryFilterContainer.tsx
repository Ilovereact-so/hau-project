'use client'
import { Portal } from '@/hooks/Portal'
import { SubcategoryWithCategory } from '@/sanity/helpers'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, FilterIcon, Trash, X } from 'lucide-react'
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { GetSlugProduct } from 'sanity.types'
import { Filter, FilterValue } from './OptionWidthImageFromVariant'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { LEGACY_PRICE_PARAM, PRICE_MAX_PARAM, PRICE_MIN_PARAM } from '@/lib/listingFilters'
import { sortFilterValues } from '@/lib/filterValueOrder'

type Props ={
    subcategoryDetails: SubcategoryWithCategory;
    products: GetSlugProduct[];
    paramsFilter: Record<string, string[]>
    /** Zakres cen całej listy (całe złote) — podpowiedzi w polach „od/do”. */
    priceBounds?: { min: number; max: number } | null
    /** Przedział ceny z adresu (`cena_od` / `cena_do`). */
    priceRange?: { min: number | null; max: number | null }
    // Podpowiedź z middleware (User-Agent) przekazana z page.tsx (server component,
    // ten sam mechanizm co initialMobile w NavbarContainer/NavRMenu) — bez tego
    // useMediaQuery zakładał desktop na pierwszym renderze niezależnie od
    // urządzenia, więc na realnym mobile chwilę renderowała się wersja desktopowa
    // (pełny rząd pilli filtrów) i wychodziła poza zaokrągloną pigułkę, zanim po
    // hydracji realny matchMedia przełączył na mobile.
    initialMobile?: boolean
}
type FilterStateItem = {
  selected: FilterValue[];
  _id: string;
  key: string;
  label: string;
  type: string;
  UX_type: string;
};
const priceFormatter = new Intl.NumberFormat("pl-PL", {
        style: "currency",
        currency: "PLN",
        minimumFractionDigits: 0,
})

const SubcategoryFilterContainer = ({subcategoryDetails, products, paramsFilter, priceBounds = null, priceRange = { min: null, max: null }, initialMobile = false}:Props) => {
    const mobileSize = useMediaQuery('(max-width: 768px)', initialMobile)
    const miniSize = useMediaQuery('(max-width: 470px)', initialMobile)
    const avaibleFilters = subcategoryDetails?.availableFilters
    const comboAvailableFilters = avaibleFilters?.map(item => ({
    ...item,
    // Rozmiary (mikro → duży, XS → XXL) rosnąco, reszta w kolejności z danych.
    filters: sortFilterValues((
        products?.flatMap(Pitem =>
        Pitem.filterValues?.filter(
            PFitem => PFitem.filter?._ref === item._id
        ) ?? []
        ) ?? []
    ).filter(
        ((seen) => v =>
        seen.has(v._id) ? false : seen.add(v._id)
        )(new Set())
    // Sanity/GROQ zwraca zdereferencowane pola jako `T | null` (np. `value: string | null`,
    // `slug: Slug | null` w GetSlugProduct), a nasz własny typ FilterValue (OptionWidthImageFromVariant.tsx)
    // jest pisany idiomatycznie w TS jako `value?: string` / `slug?: Slug`, czyli `T | undefined`.
    // Pod strict:true `null` nie jest przypisywalny do `T | undefined`, więc przy przekazywaniu
    // tych elementów dalej jako prop `item: Filter & { filters: FilterValue[] }` (FilterCard)
    // TS się wywalał. To jest sedno problemu — normalizujemy null -> undefined raz, na granicy
    // wejścia danych z Sanity do naszych własnych typów, zamiast rozwadniać FilterValue na
    // `T | null` (co zepsułoby jego kontrakt wszędzie indziej, gdzie jest już używany).
    ).map((v): FilterValue => ({
        _id: v._id,
        value: v.value ?? undefined,
        slug: v.slug ?? undefined,
    })), (v) => v.value)
    }))
    
    type hydrated ={
        parent_id : string;
        filters: FilterValue[]
    }

    function hydrateSelectedValues(
        filtersFromUrl: Record<string, string[]> 
        ): hydrated[] {
        return Object.entries(filtersFromUrl)
        .map(([key, slugs]) => {
        const parent = comboAvailableFilters?.find(f => f.key === key)
        if (!parent) return null

        const hydratedFilters = slugs
            .map(slug =>
            parent.filters.find(
                fv => fv.slug?.current === slug
            )
            )
            .filter(Boolean)
            .map(fv => ({
            _id: fv!._id,
            value: fv!.value,
            slug: fv!.slug,
            }))

        return {
            parent_id: parent._id,
            filters: hydratedFilters,
        }
        })
        .filter(Boolean) as hydrated[]
    }

    //console.log(hydrateSelectedValues(paramsFilter), "initialParmsFilter")
    //console.log(comboAvailableFilters)
    const [isOpenPrice, setOpenPrice] = useState<boolean>(false)

    // Filtr ceny „od – do”: dwa pola tekstowe (puste = bez granicy), więc da
    // się szukać np. „od 100 zł” bez górnego limitu. Szkic w stanie, adres
    // (cena_od / cena_do) zmienia dopiero „Zastosuj” / ✓.
    const appliedMin = priceRange.min
    const appliedMax = priceRange.max
    const [priceDraft, setPriceDraft] = useState<PriceDraft>(() => priceDraftFrom(appliedMin, appliedMax))
    useEffect(() => {
        setPriceDraft(priceDraftFrom(appliedMin, appliedMax))
    }, [appliedMin, appliedMax])
    const draftMin = parsePriceInput(priceDraft.min)
    const draftMax = parsePriceInput(priceDraft.max)
    const isPriceDefault = draftMin === null && draftMax === null
    const priceChanged = draftMin !== appliedMin || draftMax !== appliedMax
    const priceApplied = appliedMin !== null || appliedMax !== null

    const resetPrice = () => setPriceDraft({ min: '', max: '' })

    const hydrated = hydrateSelectedValues(paramsFilter)
    const [isSelectedList, setSelectList] = useState<FilterStateItem[]>(
    avaibleFilters?.map(items => {
        const match = hydrated.find(
        h => h.parent_id === items._id
        )

        return {
        ...items,
        selected: match?.filters ?? [],
        }
    }) ?? []
    )
    // "Czy jest cokolwiek do zastosowania/wyczyszczenia" — filtry enum ALBO cena
    // odbiegająca od domyślnej. Jedno miejsce prawdy używane przez "Wybrano:",
    // "Zastosuj" i kosz w drawerze (Portal), zamiast każdy z nich osobno sprawdzał
    // tylko isSelectedList i ignorował cenę.
    const hasAnySelection = isSelectedList.some(item => item.selected.length > 0) || !isPriceDefault
    // Czy stan w panelu różni się od zastosowanego (z adresu). Bez tego „Zastosuj”
    // znikał po odznaczeniu OSTATNIEGO filtra: nic nie było zaznaczone, więc
    // przycisk był zablokowany, a zmiana (wyczyszczenie filtrów) nie dała się
    // zastosować — lista zostawała przefiltrowana.
    const selectionKey = (entries: Array<[string, string[]]>) =>
        JSON.stringify(entries.filter(([, ids]) => ids.length).map(([id, ids]) => [id, [...ids].sort()]).sort())
    const hasPendingChanges =
        selectionKey(hydrated.map(h => [h.parent_id, h.filters.map(f => f._id)])) !==
            selectionKey(isSelectedList.map(item => [item._id, item.selected.map(v => v._id)])) ||
        priceChanged
    const canApply = hasAnySelection || hasPendingChanges

    const [isOpenMenu, setOpenMenu] = useState(false)
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    
    const buildUrl = (params: URLSearchParams) => `${pathname}${params.toString() ? `?${params.toString()}` : ""}`

    const writePrice = (params: URLSearchParams, min: number | null, max: number | null) => {
        params.delete(PRICE_MIN_PARAM)
        params.delete(PRICE_MAX_PARAM)
        params.delete(LEGACY_PRICE_PARAM)
        // Odwrócone granice (od 100 do 50) — zamieniamy, zamiast dać pustą listę.
        const [lo, hi] = min !== null && max !== null && min > max ? [max, min] : [min, max]
        if (lo !== null) params.set(PRICE_MIN_PARAM, String(lo))
        if (hi !== null) params.set(PRICE_MAX_PARAM, String(hi))
    }

    const applyPrice = () => {
        const params = new URLSearchParams(searchParams.toString())
        writePrice(params, draftMin, draftMax)
        router.replace(buildUrl(params), { scroll: false })
        setOpenPrice(false)
    }

    // Adres buduje się z bieżących parametrów (pathname zamiast stałego
    // /subcategory/${slug}) — komponent działa też na /category i /search,
    // a zmiana filtrów nie gubi sortowania ani frazy.
    const changeFilter = (list : FilterStateItem[], price?: { min: number | null; max: number | null }) => {
        const params = new URLSearchParams(searchParams.toString())
        if (price) writePrice(params, price.min, price.max)
        list?.forEach(filter => {
        params.delete(filter.key)
        })
        list?.forEach(filter => {
        filter.selected.forEach(value => {
            const slug = value.slug?.current
            if (slug) params.append(filter.key, slug)
        })
        })
        router.replace(buildUrl(params), { scroll: false })
    }
    const containerRef = useRef<HTMLDivElement>(null)
    const priceBoxRef = useRef<HTMLDivElement>(null)
    const moreRef = useRef<HTMLDivElement>(null)
    const widthsRef = useRef(new Map<string, number>());
    const [ready, setReady] = useState(false);
    const [visibleCount, setVisibleCount] = useState(avaibleFilters?.length || 0)

    // Ile pigułek filtrów zmieści się w rzędzie. Miejsce zajęte przez pigułkę
    // ceny i „Więcej..” jest MIERZONE (wcześniej stała 400 px, która nie
    // wiedziała, że cena po otwarciu rośnie do 300 px — rząd wylewał się
    // i wypychał sortowanie poza dock). Odstępy `space-x-3` też się liczą.
    // Przy otwieraniu ceny od razu rezerwujemy jej docelową szerokość (pigułki,
    // które się nie zmieszczą, znikają, zanim cena urośnie); przy zamykaniu
    // ResizeObserver oddaje miejsce w miarę, jak pigułka ceny się kurczy.
    const calculateVisibleCount = useCallback(() => {
        const container = containerRef.current
        if (!container || !avaibleFilters) return;
        const containerWidth = container.clientWidth;
        const measuredPrice = priceBoxRef.current?.offsetWidth ?? 0
        const priceWidth = isOpenPrice ? Math.max(measuredPrice, PRICE_PILL_OPEN_WIDTH) : measuredPrice
        const moreWidth = moreRef.current?.offsetWidth ?? 0
        let used = priceWidth + moreWidth + (priceWidth ? PILL_GAP : 0);
        let count = 0;
        for (const f of avaibleFilters) {
            const w = widthsRef.current.get(f._id);
            if (!w || used + PILL_GAP + w > containerWidth) break;
            used += PILL_GAP + w;
            count++;
        }
        setVisibleCount(count);
    }, [avaibleFilters, isOpenPrice]);

    const handleMeasure = (id: string, width: number) => {
        widthsRef.current.set(id, width);

        if (widthsRef.current.size === avaibleFilters?.length) {
            setReady(true);
        }
    };

    useLayoutEffect(() => {
        if (!ready) return;
        calculateVisibleCount();
    }, [ready, avaibleFilters, calculateVisibleCount]);

    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver(() => {
            calculateVisibleCount();
        });
        resizeObserver.observe(containerRef.current);
        if (priceBoxRef.current) resizeObserver.observe(priceBoxRef.current);
        if (moreRef.current) resizeObserver.observe(moreRef.current);
        return () => {
            resizeObserver.disconnect();
        };
    }, [avaibleFilters, calculateVisibleCount]);
    
    

    const handleContainerClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        if (e.target == e.currentTarget) {
            setOpenMenu(false);
        }
    }
  return (
    // `contain: inline-size` — szerokość tego bloku wynika z układu strony, a NIE
    // z jego zawartości. Bez tego kolumna filtrów w docku (flex) rosła razem
    // z rzędem pigułek i wypychała sortowanie poza obrys. W przeciwieństwie do
    // overflow nie przycina rozwijanych list (patrz komentarz niżej).
    <div className='w-full min-w-0 [contain:inline-size]'>
        {/* NIE dodawać tu overflow (ani overflow-x-auto, ani overflow-hidden).
            Rozwijana lista filtra (FilterCard niżej) jest pozycjonowana
            `absolute top-[calc(100%+8px)]` i MUSI wyjść poza ten kontener —
            wysuwa się pod całą pigułką, nad resztą strony.

            Per spec CSS: gdy overflow-x dostaje wartość inną niż `visible`, a
            overflow-y zostaje `visible`, to overflow-y automatycznie przyjmuje
            wartość `auto`. Czyli samo `overflow-x-auto` włączało też przycinanie
            w pionie — rozwinięta lista przestawała uciekać poza rodzica i zamiast
            tego rozpychała go w wysokość, dokładając scroll. Dlatego to zostało
            usunięte.

            Zabezpieczeniem przed poziomym wylewaniem się pilli jest system pomiaru
            (MeasureItem → widthsRef → visibleCount), który z góry przycina listę do
            tylu sztuk, ile faktycznie się mieści, plus przycisk "Więcej..".
            Na mobile ten cały blok w ogóle się nie renderuje (patrz !mobileSize) —
            tam filtry obsługuje osobny drawer. Reguła #filter-scroll::-webkit-scrollbar
            w globals.css jest więc celowo nieaktywna. */}
        <div ref={containerRef} id='filter-scroll' className="flex space-x-3 w-full md:pb-1 rounded-[20px]">
            <AnimatePresence>
            {isOpenMenu && 
            <Portal>
                {/* Wysokość szuflady zależy od WYSOKOŚCI okna, nie tylko szerokości:
                    na niskich ekranach (≤ 820 px wysokości okna, telefony) 90%
                    z marginesem 5% od dołu; na wysokich monitorach 80% i 10% od dołu.
                    Treść w środku przewija się, gdy i tak się nie zmieści. */}
                <motion.div onClick={(e)=>handleContainerClick(e)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{opacity:0}} className={`fixed z-9999 top-0 left-0 w-[100vw] h-[100svh] bg-gradient-to-b from-white/60 from-[90%] to-transparent inset-0 flex ${
                    isOpenMenu ? "flex":"hidden"
                }`}>
                    <motion.div initial={{ translateX: "100%" }} animate={{ translateX: "0%" }} exit={{ translateX: "100%" }} className='bg-background subcategory-dock-shadow-portal flex flex-col font-poppins md:min-w-[400px] max-w-[90%] max-h-[90%] bottom-[5%] md:[@media(min-height:821px)]:max-h-[80%] md:[@media(min-height:821px)]:bottom-[10%] max-md:space-y-2 h-auto rounded-l-[40px] md:px-6 px-4 md:py-6 py-4 absolute right-0 '>
                        <div className='flex justify-between items-center'>
                            <h1 className='font-medium text-[clamp(15px,2.3vw,19px)] text-black ml-2'>Filtruj</h1>    
                            <div onClick={()=> setOpenMenu(false)} className="cursor-pointer">
                                    <X className='w-[20px] h-[20px] text-black'/>
                            </div>
                        </div>
                        <div className='flex flex-col max-w-[310px] md:space-y-3 space-y-1 overflow-auto'>
                                           
                            <div className='flex flex-col items-stretch filterOutscroll overflow-auto'>
                                {/**Price */}
                                <div className='flex flex-col md:my-3 py-2 px-2 space-y-2'>
                                    <h1 className='text-[clamp(12px,2vw,16px)] text-black'>Cena:</h1>
                                    <PriceRangeInputs draft={priceDraft} onChange={setPriceDraft} bounds={priceBounds} />
                                </div>
                                {comboAvailableFilters && comboAvailableFilters.map((item,i)=>(
                                    <div key={i} className='w-full flex flex-col'>
                                        <div className='flex flex-col px-2 md:my-3 my-1 space-y-2'>
                                            <h1 className='text-[clamp(12px,2vw,16px)] text-black'>{item.label}:</h1>
                                            <div className='flex flex-wrap auto-cols-max gap-2'>
                                                {item.type === "enum" && item.filters.map((Fitem,index)=>(
                                                    <div 
                                                        key={index} 
                                                        //onClick={()=> setSelectList(prev => prev?.map(Sitem=> Sitem._id === item._id ? {...Sitem, selected: [...Sitem.selected, Fitem] }: Sitem))} 
                                                        onClick={()=>setSelectList(prev =>
                                                            prev?.map(Sitem =>
                                                                Sitem._id === item._id
                                                                ? {
                                                                    ...Sitem,
                                                                    selected: Sitem.selected.some(SSitem=> SSitem._id === Fitem._id)
                                                                        ? Sitem.selected.filter(v => v._id !== Fitem._id)
                                                                        : [...Sitem.selected, Fitem],
                                                                    }
                                                                : Sitem
                                                            )
                                                            )
                                                        }
                                                        className={`px-3 py-2 w-fit text-[clamp(12px,2vw,14px)] rounded-[10px] border-1 cursor-pointer ease-in-out duration-100 ${
                                                            isSelectedList?.find(Sitem => Sitem._id === item._id && Sitem.selected.some(SSitem=>SSitem._id === Fitem._id )) ? "bg-main text-black border-main" : "text-black border-black"
                                                        }`}
                                                    >
                                                        {Fitem.value}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className='flex flex-col mt-2'>
                            {/* hasAnySelection = filtry enum ALBO wpisany przedział ceny.
                                Wcześniej to wszystko (rozwinięcie boksu, nagłówek "Wybrano:", odblokowanie
                                "Zastosuj", odblokowanie kosza) patrzyło wyłącznie na isSelectedList — cena
                                była całkowicie niewidoczna dla tego stanu. Efekt: zmiana samej ceny nie
                                odblokowywała "Zastosuj" (przycisk miał pointer-events-none w tym stanie,
                                więc kliknięcie było fizycznie niemożliwe, mimo że changeFilter i tak by ją
                                zaaplikował), a kosz czyścił tylko filtry enum, zostawiając cenę bez zmian. */}
                            <div className={`flex flex-col h-auto justify-between bg-fancy-black rounded-[20px] self-stretch overflow-hidden ease-in-out duration-200 ${
                                hasAnySelection ? "w-full opacity-100 py-3 max-md:max-h-[200px]":"max-md:max-h-auto py-3"
                            }`}>
                                <div className='w-full text-[clamp(13px,1.1vw,15px)] text-white pb-2 flex-1 min-h-0 filterOutscroll overflow-auto max-h-[200px] max-w-[310px]'>
                                    <AnimatePresence key={hasAnySelection ? "selected":"empty"}>
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                            {hasAnySelection ? (
                                                <h1 className='px-6'>Wybrano:</h1>
                                            ) : hasPendingChanges ? (
                                                <h1 className='px-6 text-white/80'>Brak wybranych filtrów — kliknij „Zastosuj”, aby je wyczyścić</h1>
                                            ) : (
                                                <h1 className='px-6 text-white/80'>Brak wybranych filtrów</h1>
                                            )}
                                            {!isPriceDefault && (
                                                <div>
                                                    <h1 className='ml-3 md:mt-3 mt-1 px-7'>Cena:</h1>
                                                    <div className='pr-6 group pl-16 md:py-[6px] py-1 flex items-center justify-between hover:bg-[#121212] text-main bg-transparent ease-in-out duration-300'>
                                                        <p>{formatPriceRange(draftMin, draftMax)}</p>
                                                        <X onClick={resetPrice} className='text-red-900/80 mr-2 group-hover:opacity-100 opacity-0 w-[20px] h-[20px] cursor-pointer ease-in-out duration-300'></X>
                                                    </div>
                                                </div>
                                            )}
                                            {
                                            isSelectedList && isSelectedList.map((item, index)=>(
                                                    <div key={index}>
                                                        {item.selected.length > 0 && (
                                                            <h1 className='ml-3 md:mt-3 mt-1 px-7'>{item.label}:</h1>
                                                        )}
                                                        {item.selected.length > 0 && item.selected.map((Fitem,i)=>(
                                                            <div  key={i} className='pr-6 group pl-16 md:py-[6px] py-1 flex items-center justify-between hover:bg-[#121212] text-main bg-transparent ease-in-out duration-300'>
                                                                <p>{Fitem?.value}</p>
                                                                <X onClick={()=>setSelectList(prev =>
                                                                    prev?.map(Sitem =>
                                                                        Sitem._id === item._id
                                                                        ? {
                                                                            ...Sitem,
                                                                            selected: Sitem.selected.some(SSitem=> SSitem._id === Fitem._id)
                                                                                ? Sitem.selected.filter(v => v._id !== Fitem._id)
                                                                                : [...Sitem.selected],
                                                                            }
                                                                        : Sitem
                                                                    )
                                                                    )
                                                                } className='text-red-900/80 mr-2 group-hover:opacity-100 opacity-0 w-[20px] h-[20px] cursor-pointer ease-in-out duration-300'></X>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))
                                            }
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                                <hr className='mx-4 my-2'/>
                                <div className='w-full flex justify-start space-x-5 px-5 items-center shrink-0 '>
                                    <div onClick={()=>{changeFilter(isSelectedList, { min: draftMin, max: draftMax });setOpenMenu(false)}} className={`bg-black rounded-full cursor-pointer px-6 py-2 w-fit text-white font-medium text-[clamp(13px,1.4vw,15px)] ${
                                        canApply ? "bg-black text-white cursor-pointer":"bg-[#00000031] text-white/50 cursor-not-allowed pointer-events-none"
                                    }`}>Zastosuj</div>
                                    <Trash
                                    onClick={() => {
                                        setSelectList(prev =>
                                            prev?.map(item => ({
                                            ...item,
                                            selected: [],
                                            }))
                                        )
                                        resetPrice()
                                    }} className={`text-white cursor-pointer w-[20px] h-[20px] ${
                                        hasAnySelection ? "text-white cursor-pointer":"text-white/80 cursor-not-allowed pointer-events-none"
                                    }`}/>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                    
                </motion.div>
                
            </Portal>
            }
            </AnimatePresence>
            {!mobileSize &&
                <div ref={priceBoxRef} className='shrink-0'>
                <PricePill
                    open={isOpenPrice}
                    onOpen={() => setOpenPrice(true)}
                    onClose={() => { setOpenPrice(false); setPriceDraft(priceDraftFrom(appliedMin, appliedMax)) }}
                    onApply={applyPrice}
                    draft={priceDraft}
                    onChange={setPriceDraft}
                    bounds={priceBounds}
                    label={priceApplied ? formatPriceRange(appliedMin, appliedMax, true) : 'Cena'}
                    active={priceApplied}
                />
                </div>
            }
            {/* Rząd "pill" filtrów + system pomiaru szerokości (ready/visibleCount/
                MeasureItem) to wyłącznie desktopowy skrót — mobile ma pełny panel
                filtrów w drawerze (Portal wyżej, isOpenMenu), więc te same filtry są
                tam już kompletnie obsłużone. Wcześniej to całe pomiarowo-renderujące się
                niżej niezależnie od mobileSize — na wąskim ekranie i tak próbowało się
                zmierzyć/zmieścić (i wychodziło poza pigułkę), a dopiero PO tym
                render dowiadywał się, że jest mobile. Teraz mobileSize bramkuje to od
                razu, zanim cokolwiek z tego zacznie się liczyć/renderować. */}
            {!mobileSize && (
                <>
                    {!ready && comboAvailableFilters &&
                    comboAvailableFilters.map(f => (
                        <MeasureItem
                        key={f._id}
                        id={f._id}
                        onMeasure={handleMeasure}
                        >
                            <FilterCard item={f} setSelectList={setSelectList} isSelectedList={isSelectedList} changeFilter={changeFilter} />
                        </MeasureItem>
                    ))}
                    {/* Fade-in zamiast nagłego "wyskoczenia" pilli w momencie gdy ready
                        przełącza się na true — bez tego lista po prostu pojawiała się
                        skokowo, stąd wrażenie że ładowanie filtrów nie jest smooth. */}
                    <AnimatePresence>
                        {ready && comboAvailableFilters && comboAvailableFilters?.slice(0, visibleCount).map((item, i) => (
                            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: "easeInOut", delay: i * 0.03 }}>
                                <FilterCard item={item} setSelectList={setSelectList} isSelectedList={isSelectedList} changeFilter={changeFilter} />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </>
            )}
            <div ref={moreRef} onClick={()=>setOpenMenu(true)} className={`shrink-0 md:bg-main bg-black md:mb-2 cursor-pointer py-2 text-[clamp(15px,1.4vw,17px)] md:text-black text-white font-medium whitespace-nowrap border-black border-1 ${!miniSize ? "px-8 rounded-[20px]":"px-4 rounded-[16px]"}`}>{!mobileSize ? "Więcej.." : !miniSize ? "Filtruj" : (
                <div className='xs:py-[3px] py-[2px]'><FilterIcon className="w-[15px] h-[15px] text-white"/></div>
            )}</div>

        </div>
    </div>
  )
}




type filterCardProps = {
    item: Filter & {filters: FilterValue[]},
    setSelectList: React.Dispatch<React.SetStateAction<FilterStateItem[]>>,
    isSelectedList: FilterStateItem[],
    changeFilter: (list: FilterStateItem[], price?: { min: number | null; max: number | null }) => void,
}

const FilterCard = ({item, setSelectList, isSelectedList, changeFilter}: filterCardProps)=>{
    const [isOpenInlineMenu, setOpenInlineMenu] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    useClickOutside(menuRef, () => setOpenInlineMenu(false));

    return (
    <motion.div className={`relative h-fit`}>
        {isOpenInlineMenu && (
            <AnimatePresence mode='wait'>
                <motion.div 
                initial={{opacity: 0}}
                animate={{opacity: 1}} 
                transition={{duration: 0.2, ease:"easeInOut"}}
                className={`absolute right-0 flex translate-y-[100%] h-[8px] bottom-0 w-full `}>
                    <div className='bg-main w-full h-full'></div>
                    <div className='absolute bottom-0 right-[1px] translate-x-[100%] overflow-hidden w-[14px] h-[14px]'>
                        <div id='sh-filter-menu' className={`rounded-bl-[14px]`}></div>
                    </div>
                </motion.div>
            </AnimatePresence>
        )}
        
        <motion.div onClick={()=>setOpenInlineMenu(!isOpenInlineMenu)} 
        className={`cursor-pointer px-8 py-2 text-[clamp(15px,1.4vw,17px)] font-medium border-1 border-transparent whitespace-nowrap`}
        initial={{backgroundColor: "#000000", color: "#ffffff", borderRadius: "20px"}}
        animate={isOpenInlineMenu ? {backgroundColor: "var(--main)", color: "#000000", borderRadius: "20px 20px 0 0"}:{backgroundColor: "#000000", color: "#ffffff", borderRadius: "20px"}}
        transition={{duration: 0.2, ease:"easeInOut"}}
        >
            <p >{item.label}</p>
        </motion.div>
        {isOpenInlineMenu && (
            <AnimatePresence mode='wait' >
            <motion.div ref={menuRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{opacity:0}} transition={{duration:0.2, ease:"easeInOut"}} className='bg-[#b3d8d4] absolute shadow-[0_18px_40px_rgba(0,0,0,0.18)] top-[calc(100%+8px)] rounded-b-[12px] px-5 space-y-3 py-3 rounded-r-[12px] flex flex-col min-w-[calc(100%+26px)]'>
                    {item.type === "enum" && item.filters.map((Fitem,index)=>(
                        <label key={index} 
                        onClick={()=>setSelectList(prev =>
                            prev?.map(Sitem =>
                                Sitem._id === item._id
                                ? {
                                    ...Sitem,
                                    selected: Sitem.selected.some(SSitem=> SSitem._id === Fitem._id)
                                        ? Sitem.selected.filter(v => v._id !== Fitem._id)
                                        : [...Sitem.selected, Fitem],
                                    }
                                : Sitem
                            )
                            )
                        }
                        className='flex space-x-3 items-center justify-start cursor-pointer w-fit'>
                            <div className={`checkbox-filter flex justify-center items-center rounded-[4px] w-[14px] h-[14px] ${
                                isSelectedList?.find(Sitem => Sitem._id === item._id && Sitem.selected.some(SSitem=>SSitem._id === Fitem._id )) ? "bg-fancy-black":"bg-white"
                            }`}>
                                <Check className='w-[12px] h-[12px] text-white'/>
                            </div>
                            <p className="text-black rounded-md text-[14px] inline w-fit">
                                {Fitem.value}
                            </p>
                        </label>
                    ))}
                    <div onClick={() => changeFilter(isSelectedList)} className="cursor-pointer bg-fancy-black text-white px-4 flex justify-center py-[6px] rounded-[14px] font-poppins text-[14px] font-medium">Zatwierdź</div>
            </motion.div>
            </AnimatePresence>
        )}
    </motion.div>
    )
}

type MeasureItemProps = {
  id: string;
  onMeasure: (id: string, width: number) => void;
  children: React.ReactNode;
};
function MeasureItem({ id, onMeasure, children }: MeasureItemProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const w = ref.current.offsetWidth;
    onMeasure(id, w);
    }, [id, onMeasure]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        visibility: "hidden",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

/** Odstęp między pigułkami w docku (`space-x-3`). */
const PILL_GAP = 12
/** Szerokość otwartej pigułki ceny (pola „od – do”). */
const PRICE_PILL_OPEN_WIDTH = 300

type PriceDraft = { min: string; max: string }

const priceDraftFrom = (min: number | null, max: number | null): PriceDraft => ({
    min: min === null ? '' : String(min).replace('.', ','),
    max: max === null ? '' : String(max).replace('.', ','),
})

/** Pole „od/do” → liczba (zł) albo `null` (puste / niepoprawne = bez granicy). */
function parsePriceInput(value: string): number | null {
    const text = value.trim().replace(/\s|zł/gi, '').replace(',', '.')
    if (!text) return null
    const number = Number(text)
    return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null
}

function formatPriceRange(min: number | null, max: number | null, short = false): string {
    const fmt = (value: number) => priceFormatter.format(value)
    if (min !== null && max !== null) return short ? `Cena: ${min}–${max} zł` : `od ${fmt(min)} do ${fmt(max)}`
    if (min !== null) return short ? `Cena: od ${min} zł` : `od ${fmt(min)}`
    if (max !== null) return short ? `Cena: do ${max} zł` : `do ${fmt(max)}`
    return 'Cena'
}

/** Dwa pola „od – do”. Podpowiedzi = najniższa i najwyższa cena na liście. */
function PriceRangeInputs({
    draft,
    onChange,
    bounds,
    compact = false,
    onEnter,
}: {
    draft: PriceDraft
    onChange: (next: PriceDraft) => void
    bounds: { min: number; max: number } | null
    compact?: boolean
    onEnter?: () => void
}) {
    const inputClass = `w-full min-w-0 text-center text-black rounded-[10px] focus:outline-none focus:ring-2 focus:ring-black/20 placeholder:text-[#8E8E8E] ${
        compact ? 'bg-white/80 text-[13px] leading-none h-[24px] py-0 px-1 rounded-[8px]' : 'bg-[#E1E1E1] text-[clamp(13px,2vw,16px)] py-2 px-2'
    }`
    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault()
            onEnter?.()
        }
    }
    return (
        <div className={`flex items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
            <label className='flex items-center gap-1 flex-1 min-w-0'>
                <span className={`text-black ${compact ? 'text-[13px] font-normal' : 'text-[clamp(12px,2vw,15px)]'}`}>od</span>
                <input
                    type='text'
                    inputMode='decimal'
                    aria-label='Cena od (zł)'
                    value={draft.min}
                    onChange={(e) => onChange({ ...draft, min: e.target.value })}
                    onKeyDown={onKeyDown}
                    placeholder={bounds ? String(bounds.min) : '0'}
                    className={inputClass}
                />
            </label>
            <span className='text-black'>–</span>
            <label className='flex items-center gap-1 flex-1 min-w-0'>
                <span className={`text-black ${compact ? 'text-[13px] font-normal' : 'text-[clamp(12px,2vw,15px)]'}`}>do</span>
                <input
                    type='text'
                    inputMode='decimal'
                    aria-label='Cena do (zł)'
                    value={draft.max}
                    onChange={(e) => onChange({ ...draft, max: e.target.value })}
                    onKeyDown={onKeyDown}
                    placeholder={bounds ? String(bounds.max) : ''}
                    className={inputClass}
                />
            </label>
            <span className={`text-black ${compact ? 'text-[13px] font-normal' : 'text-[clamp(12px,2vw,15px)]'}`}>zł</span>
        </div>
    )
}

/** Pigułka „Cena” w docku filtrów (desktop): rozwija się w pola „od – do”. */
function PricePill({
    open,
    onOpen,
    onClose,
    onApply,
    draft,
    onChange,
    bounds,
    label,
    active,
}: {
    open: boolean
    onOpen: () => void
    onClose: () => void
    onApply: () => void
    draft: PriceDraft
    onChange: (next: PriceDraft) => void
    bounds: { min: number; max: number } | null
    label: string
    active: boolean
}) {
    const ref = useRef<HTMLDivElement>(null)
    useClickOutside(ref, () => open && onClose())
    // Wysokość pigułki wyznacza ZAWSZE napis (po otwarciu niewidoczny), a pola
    // leżą na nim warstwą `absolute` — otwarta cena ma więc dokładnie tę samą
    // wysokość co pozostałe pigułki i nie rozpycha docka w pionie.
    return (
        <motion.div
            ref={ref}
            initial={false}
            animate={{ width: open ? PRICE_PILL_OPEN_WIDTH : 'auto' }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            onClick={() => !open && onOpen()}
            className={`py-2 flex md:mb-2 relative items-center justify-center text-[clamp(15px,1.4vw,17px)] font-medium rounded-[20px] overflow-hidden whitespace-nowrap border-1 ${
                open ? 'px-3 bg-main text-black border-white' : active ? 'px-6 bg-main text-black border-main cursor-pointer' : 'px-6 text-white border-black bg-black cursor-pointer'
            }`}
        >
            <p className={`text-center select-none ${open ? 'invisible' : ''}`} aria-hidden={open}>{label}</p>
            {open && (
                <div className='absolute inset-y-0 left-3 right-2 flex items-center gap-1.5'>
                    <div className='flex-1 min-w-0'>
                        <PriceRangeInputs draft={draft} onChange={onChange} bounds={bounds} compact onEnter={onApply} />
                    </div>
                    <button
                        type='button'
                        aria-label='Zastosuj cenę'
                        onClick={(e) => { e.stopPropagation(); onApply() }}
                        className='w-[24px] h-[24px] flex items-center justify-center rounded-full hover:scale-90 cursor-pointer bg-[#9898984d] ease-in-out duration-100 shrink-0'
                    >
                        <Check className='w-[15px] h-[15px]' />
                    </button>
                </div>
            )}
        </motion.div>
    )
}

export default SubcategoryFilterContainer
