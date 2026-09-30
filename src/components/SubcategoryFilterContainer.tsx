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

type Props ={
    subcategoryDetails: SubcategoryWithCategory;
    products: GetSlugProduct[];
    paramsFilter: Record<string, string[]>
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

const SubcategoryFilterContainer = ({subcategoryDetails, products, paramsFilter, initialMobile = false}:Props) => {
    const mobileSize = useMediaQuery('(max-width: 768px)', initialMobile)
    const miniSize = useMediaQuery('(max-width: 470px)', initialMobile)
    const avaibleFilters = subcategoryDetails?.availableFilters
    const maxPrice = 300
    const minPrice = 0
    const comboAvailableFilters = avaibleFilters?.map(item => ({
    ...item,
    filters: (
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
    }))
    }))
    
    type hydrated ={
        parent_id : string;
        filters: FilterValue[]
    }
    //const [isPriceFilter, setPriceFilter] = useState<number>(maxPrice)
    const isPriceFilter = paramsFilter && paramsFilter['price'] ? Number(paramsFilter['price'][0]) : maxPrice 

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
    const sliderRef = useRef<HTMLInputElement>(null)
    const sliderRefOut = useRef<HTMLInputElement>(null)
    const sliderNumRefOut = useRef<HTMLInputElement>(null)
    const sliderNumRef = useRef<HTMLInputElement>(null)

    // Cena w drawerze (Portal, sliderRefOut/sliderNumRefOut) była czysto
    // niekontrolowana — żyła tylko w DOM-refach, nigdy w React state. Dlatego
    // przycisk "Zastosuj"/"Wybrano:"/kosz działały wyłącznie na podstawie
    // isSelectedList (filtry enum) i kompletnie ignorowały cenę: zmiana samej
    // ceny nie odblokowywała "Zastosuj" (mimo że kliknięcie i tak by ją
    // zaaplikowało — przycisk był tylko WIZUALNIE disabled i pointer-events-none,
    // więc user fizycznie nie mógł go kliknąć), kosz nie resetował suwaka, a
    // podsumowanie "Wybrano:" nigdy jej nie pokazywało. priceValue to jedno
    // źródło prawdy dla "czy cena odbiega od domyślnej (maxPrice)", zsynchronizowane
    // z URL tym samym efektem co dotąd synchronizował same refy.
    const [priceValue, setPriceValue] = useState<number>(isPriceFilter)
    const isPriceDefault = priceValue === maxPrice

    const resetPrice = () => {
        setPriceValue(maxPrice)
        if (sliderRefOut.current) sliderRefOut.current.value = String(maxPrice)
        if (sliderNumRefOut.current) sliderNumRefOut.current.value = priceFormatter.format(maxPrice)
    }

    useEffect(()=>{
        if( sliderRef.current && sliderRefOut.current && sliderNumRef.current && sliderNumRefOut.current){
            sliderRef.current.value = isPriceFilter.toString()
            sliderRefOut.current.value = isPriceFilter.toString()
            sliderNumRef.current.value = priceFormatter.format(isPriceFilter)
            sliderNumRefOut.current.value = priceFormatter.format(isPriceFilter)
        }
        setPriceValue(isPriceFilter)
    }, [paramsFilter,isPriceFilter])

    const handleChange = (ref:  React.RefObject<HTMLInputElement | null>, currentRef: React.RefObject<HTMLInputElement | null> , e: React.ChangeEvent<HTMLInputElement>)=>{
        if(ref.current && currentRef.current){
            if(ref.current.type === "text"){
                ref.current.value = priceFormatter.format(priceValidate(Number(e.target.value)))
            }else{
            ref.current.value = String(priceValidate(Number(e.target.value)))
            }
            // if(String(priceValidate(Number(e.target.value))) != e.target.value){
            //     currentRef.current.value = String(priceValidate(Number(e.target.value)))
            // }
        }
    }
    const priceValidate = (value:number)=>{
        return value > maxPrice ? maxPrice : value < minPrice ? minPrice : value
    }
    
    const format = (refNum : React.RefObject<HTMLInputElement | null>, ref : React.RefObject<HTMLInputElement | null>) => {
        if (!refNum.current || !ref.current) return
        refNum.current.value = priceFormatter.format(Number(ref.current.value))
    }

    const unformat = (refNum : React.RefObject<HTMLInputElement | null>, ref : React.RefObject<HTMLInputElement | null>) => {
        if (!refNum.current || !ref.current) return
        refNum.current.value = ref.current.value
    }
    const returnFormat = (value: number) => {
        return priceFormatter.format(value)
    }
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
    // tylko isSelectedList i ignorował priceValue.
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
        priceValue !== isPriceFilter
    const canApply = hasAnySelection || hasPendingChanges

    const [isOpenMenu, setOpenMenu] = useState(false)
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    
    const handlePriceUrl = (value: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete("price")
        if (value !== maxPrice) params.append("price", value.toString())
        const url = `${pathname}${
            params.toString() ? `?${params.toString()}` : ""
        }`

        router.replace(url, { scroll: false })
    }

    // `price` był wcześniej odczytywany bezpośrednio z DOM-refa suwaka
    // (RefObject<HTMLInputElement>) — mieszało to "co ma trafić do URL" z
    // konkretnym, niekontrolowanym elementem DOM. Teraz cena jest w React state
    // (priceValue, patrz wyżej), więc changeFilter przyjmuje zwykłą liczbę —
    // można ją wywołać z dowolnego miejsca (drawer, w przyszłości np. pill
    // desktopowy) bez przeplatania z konkretnym inputem. Gdy cena == maxPrice
    // (domyślna), w ogóle nie dopisujemy jej do URL, żeby nie zaśmiecać go
    // martwym "price=300".
    const changeFilter = (list : FilterStateItem[], price?: number) => {
        const params = new URLSearchParams(searchParams.toString())
        if (price != null) {
        params.delete("price")
        if (price !== maxPrice) params.append("price", price.toString())
        }
        // usuń WSZYSTKIE stare filtry
        list?.forEach(filter => {
        params.delete(filter.key)
        })

        // dodaj aktualne
        list?.forEach(filter => {
        filter.selected.forEach(value => {
            const slug = value.slug?.current
            if (slug) params.append(filter.key, slug)
        })
        })

  // 3️⃣ składamy URL — pathname zamiast hardkodowanego /subcategory/${slug}:
  // ten komponent renderuje się teraz też na /search (wyniki wyszukiwania),
  // więc URL filtrów musi podążać za bieżącą trasą, a nie zakładać z góry
  // że zawsze jesteśmy na /subcategory/[slug].
        const url = `${pathname}${
            params.toString() ? `?${params.toString()}` : ""
        }`

        router.replace(url, { scroll: false })
    }
    const containerRef = useRef<HTMLDivElement>(null)
    const widthsRef = useRef(new Map<string, number>());
    const [ready, setReady] = useState(false);
    const [visibleCount, setVisibleCount] = useState(avaibleFilters?.length || 0)

    const calculateVisibleCount = useCallback(() => {
        if (!containerRef.current || !avaibleFilters) return;
        const containerWidth = containerRef.current.offsetWidth;
        let used = 400;
        let count = 0;
        for (const f of avaibleFilters) {
            const w = widthsRef.current.get(f._id);
            if (!w || used + w > containerWidth) break;
            used += w;
            count++;
        }
        setVisibleCount(count);
    }, [avaibleFilters]);

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
        return () => {
            resizeObserver.disconnect();
        };
    }, [avaibleFilters, calculateVisibleCount]);
    
    

    const handleChangePrice = (ref:  React.RefObject<HTMLInputElement | null>)=>{
        if(ref.current){
            const value = Number(ref.current.value)
            handlePriceUrl(value)
        }
        setOpenPrice(false)
    }
    const handleContainerClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        if (e.target == e.currentTarget) {
            setOpenMenu(false);
        }
    }
  return (
    <div>
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
                <motion.div onClick={(e)=>handleContainerClick(e)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{opacity:0}} className={`fixed z-9999 top-0 left-0 w-[100vw] h-[100svh] bg-gradient-to-b from-white/60 from-[90%] to-transparent inset-0 flex ${
                    isOpenMenu ? "flex":"hidden"
                }`}>
                    <motion.div initial={{ translateX: "100%" }} animate={{ translateX: "0%" }} exit={{ translateX: "100%" }} className='bg-background subcategory-dock-shadow-portal flex flex-col font-poppins md:min-w-[400px] max-w-[90%] max-h-[80%] max-md:space-y-2 h-auto rounded-l-[40px] md:px-6 px-4 md:py-6 py-4 absolute right-0 bottom-[10%] '>
                        <div className='flex justify-between items-center'>
                            <h1 className='font-medium text-[clamp(15px,2.3vw,19px)] text-black ml-2'>Filtruj</h1>    
                            <div onClick={()=> setOpenMenu(false)} className="cursor-pointer">
                                    <X className='w-[20px] h-[20px] text-black'/>
                            </div>
                        </div>
                        <div className='flex flex-col max-w-[310px] md:space-y-3 space-y-1 overflow-auto'>
                                           
                            <div className='flex flex-col items-stretch filterOutscroll overflow-auto'>
                                {/**Price */}
                                <div className='flex justify-between md:my-3 py-2 px-2'>
                                    <h1 className='text-[clamp(12px,2vw,16px)] text-black'>Cena:</h1>
                                    <div className="flex space-x-2 justify-center items-center ">
                                    <input
                                    ref={sliderRefOut}
                                    onChange={(e) => {
                                        handleChange(sliderNumRefOut, sliderRefOut, e)
                                        setPriceValue(priceValidate(Number(e.target.value)))
                                    }}
                                    className="slider"
                                    type="range"
                                    defaultValue={isPriceFilter}
                                    max={maxPrice}
                                    min={minPrice}
                                    />

                                    <input
                                    ref={sliderNumRefOut}
                                    type="text"
                                    onFocus={()=>unformat(sliderNumRefOut, sliderRefOut)}
                                    onBlur={()=>format(sliderNumRefOut, sliderRefOut)}
                                    onChange={(e) => {
                                        handleChange(sliderRefOut, sliderNumRefOut, e)
                                        setPriceValue(priceValidate(Number(e.target.value)))
                                    }}
                                    defaultValue={priceFormatter.format(isPriceFilter)}
                                    max={maxPrice}
                                    className="
                                        slider-num
                                        w-[6ch]
                                        text-center
                                        text-[clamp(12px,2vw,16px)]
                                        text-black
                                        focus:outline-none
                                        focus:ring-0
                                        bg-[#E1E1E1]
                                        rounded-[10px]
                                        disabled:cursor-not-allowed
                                        [appearance:textfield]
                                        [&::-webkit-outer-spin-button]:appearance-none
                                        [&::-webkit-inner-spin-button]:appearance-none
                                    "
                                    />
                                    </div>
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
                            {/* hasAnySelection = filtry enum ALBO cena różna od maxPrice (domyślnej).
                                Wcześniej to wszystko (rozwinięcie boksu, nagłówek "Wybrano:", odblokowanie
                                "Zastosuj", odblokowanie kosza) patrzyło wyłącznie na isSelectedList — cena
                                była całkowicie niewidoczna dla tego stanu. Efekt: zmiana samej ceny nie
                                odblokowywała "Zastosuj" (przycisk miał pointer-events-none w tym stanie,
                                więc kliknięcie było fizycznie niemożliwe, mimo że changeFilter i tak by ją
                                zaaplikował), a kosz czyścił tylko filtry enum, zostawiając cenę bez zmian. */}
                            <div className={`flex flex-col h-auto justify-between bg-fancy-black rounded-[20px] self-stretch overflow-hidden ease-in-out duration-200 ${
                                hasAnySelection ? "w-full opacity-100 py-3 max-md:max-h-[200px]":"max-md:max-h-auto py-3"
                            }`}>
                                <div className='w-full text-[clamp(13px,1.1vw,15px)] text-white pb-2 flex-1 min-h-0 filterOutscroll overflow-auto max-h-[200px]'>
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
                                                        <p>do {priceFormatter.format(priceValue)}</p>
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
                                    <div onClick={()=>{changeFilter(isSelectedList, priceValue);setOpenMenu(false)}} className={`bg-black rounded-full cursor-pointer px-6 py-2 w-fit text-white font-medium text-[clamp(13px,1.4vw,15px)] ${
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
                <motion.div
                    initial={{ minWidth: "90px" }}
                    animate={{ minWidth: isOpenPrice ? "250px" : "90px" }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    onClick={()=> !isOpenPrice && setOpenPrice(true)} 
                    className={`py-2 flex md:mb-2 relative items-center justify-center text-[clamp(15px,1.4vw,17px)] font-medium rounded-[20px] overflow-hidden ease-in-out duration-300 ${ 
                        isOpenPrice ? " px-4 bg-main text-black border-white border-1 ":" px-6 text-white border-black border-1 bg-black cursor-pointer "
                    }
                    `}>
                    {isOpenPrice ? (
                        <div className="flex absolute left-[50%] translate-x-[-50%] top-[50%] translate-y-[-50%] space-x-2 justify-center items-center w-[235px]">
                            <input
                            ref={sliderRef}
                            onChange={(e) =>
                                handleChange(sliderNumRef, sliderRef, e)
                            }
                            className="slider"
                            type="range"
                            defaultValue={isPriceFilter}
                            max={maxPrice}
                            min={minPrice}
                            />

                            {/* isOpenPrice && ref: te dwa inputy renderują się tylko wewnątrz
                                {isOpenPrice ? (...) : ...} wyżej, więc warunek zawsze był prawdziwy
                                tutaj — a `ref` prop nie przyjmuje boolean|RefObject (tylko
                                Ref<T>|undefined), więc `isOpenPrice && sliderRef` ewaluujące się do
                                `false` było błędem typu. Przekazujemy ref bezpośrednio. */}
                            <input
                            ref={sliderNumRef}
                            type="text"
                            onFocus={() => unformat(sliderNumRef, sliderRef)}
                            onBlur={() => format(sliderNumRef, sliderRef)}
                            onChange={(e) =>
                                handleChange(sliderRef, sliderNumRef, e)
                            }
                            defaultValue={returnFormat(isPriceFilter)}
                            max={maxPrice}
                            className="
                                slider-num
                                w-[6ch]
                                text-center
                                text-[16px]
                                focus:outline-none
                                focus:ring-0
                                disabled:cursor-not-allowed
                                [appearance:textfield]
                                [&::-webkit-outer-spin-button]:appearance-none
                                [&::-webkit-inner-spin-button]:appearance-none
                            "
                            />

                            <div
                            onClick={() => isOpenPrice && handleChangePrice(sliderRef)}
                            className="
                                p-1
                                rounded-full
                                hover:scale-90
                                cursor-pointer
                                bg-[#9898984d]
                                ease-in-out
                                duration-100
                            "
                            >
                            <Check className="w-[18px] h-[18px]" />
                            </div>
                        </div>
                        ) : (
                        <p
                            onClick={() => setOpenPrice(true)}
                            className="
                            w-[50px]
                            text-center
                            cursor-pointer
                            select-none
                            "
                        >
                            Cena
                        </p>
                    )}                        
                </motion.div>   
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
            <div onClick={()=>setOpenMenu(true)} className={`md:bg-main bg-black md:mb-2 cursor-pointer py-2 text-[clamp(15px,1.4vw,17px)] md:text-black text-white font-medium whitespace-nowrap border-black border-1 ${!miniSize ? "px-8 rounded-[20px]":"px-4 rounded-[16px]"}`}>{!mobileSize ? "Więcej.." : !miniSize ? "Filtruj" : (
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
    changeFilter: (list: FilterStateItem[], price?: number) => void,
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
        className={`cursor-pointer px-8 py-2 text-[clamp(15px,1.4vw,17px)] font-medium`}
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

export default SubcategoryFilterContainer