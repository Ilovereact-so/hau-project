'use client'
import { Portal } from '@/hooks/Portal'
import { SubcategoryWithCategory } from '@/sanity/helpers'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, FilterIcon, Trash, X } from 'lucide-react'
import React, { Ref, use, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { GetSlugProduct, Slug } from 'sanity.types'
import PriceFormatter from './PriceFormatter'
import { FilterValue } from './OptionWidthImageFromVariant'
import { Item } from 'node_modules/@base-ui/react/esm/select/index.parts'
import { useRouter, useSearchParams } from 'next/navigation'
import Filter from '@/sanity/schemaTypes/filter'
import { FilterInlinePortal } from './FIlterInlinePortal'
import { set } from 'sanity'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useMediaQuery } from '@/hooks/useMediaQuery'

type Props ={
    subcategoryDetails: SubcategoryWithCategory;
    products: GetSlugProduct[];
    paramsFilter: Record<string, string[]>
}
const SubcategoryFilterContainer = ({subcategoryDetails, products, paramsFilter}:Props) => {
    const mobileSize = useMediaQuery('(max-width: 768px)')
    const miniSize = useMediaQuery('(max-width: 470px)')
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
    )
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

    useEffect(()=>{
        if( sliderRef.current && sliderRefOut.current && sliderNumRef.current && sliderNumRefOut.current){
            sliderRef.current.value = isPriceFilter.toString()
            sliderRefOut.current.value = isPriceFilter.toString()
            sliderNumRef.current.value = priceFormatter.format(isPriceFilter)
            sliderNumRefOut.current.value = priceFormatter.format(isPriceFilter)
            console.log("Updated slider values")
        }
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
    
    const priceFormatter = new Intl.NumberFormat("pl-PL", {
        style: "currency",
        currency: "PLN",
        minimumFractionDigits: 0,
    })

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
    const [isSelectedList, setSelectList] = useState(
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
    
    useEffect(()=>{
        console.log("isSelectedList",isSelectedList)
    }, [isSelectedList])
    
    const [isOpenMenu, setOpenMenu] = useState(false)
    const router = useRouter()
    const searchParams = useSearchParams()
    
    const handlePriceUrl = (value: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete("price")
        params.append("price", value.toString())
        const url = `/subcategory/${subcategoryDetails.slug.toString()}${
            params.toString() ? `?${params.toString()}` : ""
        }`

        router.replace(url, { scroll: false })
    }

    const changeFilter = (list : typeof isSelectedList, value?: React.RefObject<HTMLInputElement | null> ) => {
        const params = new URLSearchParams(searchParams.toString())
        if(value!= null && value.current){
        params.delete("price")
        params.append("price", value.current?.value.toString())
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

  // 3️⃣ składamy URL
        const url = `/subcategory/${subcategoryDetails.slug.toString()}${
            params.toString() ? `?${params.toString()}` : ""
        }`

        router.replace(url, { scroll: false })
    }
    const containerRef = useRef<HTMLDivElement>(null)
    const itemRefs = useRef<(HTMLDivElement | null)[]>([])
    const [visibleCount, setVisibleCount] = useState( 0 )

    useLayoutEffect(() => {
    if (!containerRef.current || !avaibleFilters) return
    const ro = new ResizeObserver(() => {
        const containerWidth = containerRef.current!.offsetWidth
        let usedWidth = 400
        let count = 0

        for (let i = 0; i < avaibleFilters.length; i++) {
        const el = itemRefs.current[i]
        if (!el) continue
        console.log(el)
        const style = getComputedStyle(el)
        const margin =
            parseFloat(style.marginLeft) +
            parseFloat(style.marginRight)

        const w = el.offsetWidth + margin
        if (usedWidth + w > containerWidth) break

        usedWidth += w
        count++
        }
        setVisibleCount(count)
    })

    ro.observe(containerRef.current)
    return () => ro.disconnect()
    }, [avaibleFilters])
    const menuRef = useRef<HTMLDivElement>(null)
    const [isOpenInlineMenu, setOpenInlineMenu] = useState(false)
    useClickOutside(menuRef, () => setOpenInlineMenu(false));

    const handleChangePrice = (ref:  React.RefObject<HTMLInputElement | null>)=>{
        if(ref.current){
            const value = Number(ref.current.value)
            handlePriceUrl(value)
        }
        setOpenPrice(false)
    }

  return (
    <div>
        <div ref={containerRef} id='filter-scroll' className="flex space-x-3 w-full md:pb-1 rounded-[20px]">
            {isOpenMenu && 
            <Portal>
                <div className={`fixed z-9999 top-0 left-0 w-[100vw] h-[100svh] bg-[#2d2d2dbd] flex-col justify-center items-center ${
                    isOpenMenu ? "flex":"hidden"
                }`}>
                    <div className='bg-background relative flex md:flex-row flex-col font-poppins md:min-w-[400px] max-w-[90%] md:max-h-[400px] max-h-[90%] max-md:space-y-3 h-auto rounded-[40px] md:px-10 px-6 py-6'>
                        <div className='flex flex-col max-w-[310px] space-y-3 overflow-auto'>
                            <h1 className='font-medium text-[clamp(15px,2.5vw,19px)] text-black ml-2'>Filtruj</h1>                   
                            <div className='flex flex-col items-stretch filterOutscroll overflow-auto'>
                                {/**Price */}
                                <div className='flex justify-between my-3 px-2'>
                                    <h1 className='text-[clamp(12px,2vw,16px)] text-black'>Cena:</h1>
                                    <div className="flex space-x-2 justify-center items-center ">
                                    <input
                                    ref={sliderRefOut}
                                    onChange={(e) =>
                                        handleChange(sliderNumRefOut, sliderRefOut, e)
                                    }
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
                                    onChange={(e) =>
                                        handleChange(sliderRefOut, sliderNumRefOut, e)
                                    }
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
                                        <div className='flex flex-col px-2 my-3 space-y-2'>
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
                        <div className='flex flex-col md:space-y-3 md:relative'>
                            <div className={`flex justify-end md:w-full max-md:absolute max-md:top-4 max-md:right-7 ${
                                isSelectedList && isSelectedList.some(item=>item.selected.length > 0) ? "":"absolute md:top-0 md:left-0"
                            }`}>
                                <div onClick={()=> setOpenMenu(false)} className="bg-fancy-black cursor-pointer rounded-full md:px-6 px-2 py-2 font-medium text-[14px]">
                                    { !mobileSize? "Wyjście": (
                                        <X className='w-[16px] h-[16px] text-white'/>
                                    )}
                                </div>
                            </div>
                            <div className={`flex flex-col h-full justify-between bg-fancy-black rounded-[20px] self-stretch md:ml-3 overflow-hidden ease-in-out duration-200 ${
                                isSelectedList && isSelectedList.some(item=>item.selected.length > 0) ? "md:w-[200px] w-full opacity-100 py-3 max-md:max-h-[200px]":"max-md:max-h-0 md:w-0 opacity-0"
                            }`}>
                                <div className='w-full text-[clamp(13px,1.1vw,15px)] text-white pb-2 flex-1 min-h-0 filterOutscroll overflow-auto'>
                                    <h1 className='px-6'>Wybrano:</h1>
                                    {
                                    isSelectedList && isSelectedList.map((item, index)=>(
                                            <div key={index}>
                                                {item.selected.length > 0 && (
                                                    <h1 className='ml-3 mt-3 px-7'>{item.label}:</h1>
                                                )}
                                                {item.selected.length > 0 && item.selected.map((Fitem,i)=>(
                                                    <div  key={i} className='pr-6 group pl-16 py-[6px] flex items-center justify-between hover:bg-[#121212] text-main bg-transparent ease-in-out duration-300'>
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
                                </div>
                                <hr className='mx-4 my-2'/>
                                <div className='w-full flex md:justify-evenly justify-between max-md:space-x-3 max-md:px-5 items-center shrink-0 '>
                                    <div onClick={()=>{changeFilter(isSelectedList, sliderRefOut);setOpenMenu(false)}} className='bg-black rounded-full cursor-pointer px-6 py-2 w-fit text-white font-medium text-[clamp(13px,1.4vw,15px)]'>Zastosuj</div>
                                    <Trash
                                    onClick={() =>
                                        setSelectList(prev =>
                                            prev?.map(item => ({
                                            ...item,
                                            selected: [],
                                            }))
                                        )
                                    } className='text-white cursor-pointer w-[20px] h-[20px]'/>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                </div>
            </Portal>
    }
            {!mobileSize &&
                <motion.div
                    initial={{ minWidth: "90px" }}
                    animate={{ minWidth: isOpenPrice ? "250px" : "90px" }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    onClick={()=> !isOpenPrice && setOpenPrice(true)} 
                    className={`py-2 flex md:mb-2 relative items-center justify-center text-[clamp(15px,1.4vw,17px)] font-medium rounded-[20px] overflow-hidden ease-in-out duration-300 ${ 
                        isOpenPrice ? " px-4 bg-[#b9bbb7] text-black border-white border-1 ":" px-6 text-white border-black border-1 bg-black cursor-pointer "
                    }
                    `}>
                    {isOpenPrice ? (
                        <div className="flex absolute left-[50%] translate-x-[-50%] top-[50%] translate-y-[-50%] space-x-2 justify-center items-center w-[235px]">
                            <input
                            ref={isOpenPrice && sliderRef}
                            onChange={(e) =>
                                handleChange(sliderNumRef, sliderRef, e)
                            }
                            className="slider"
                            type="range"
                            defaultValue={isPriceFilter}
                            max={maxPrice}
                            min={minPrice}
                            />

                            <input
                            ref={isOpenPrice && sliderNumRef}
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
            {comboAvailableFilters && comboAvailableFilters?.slice(0, visibleCount).map((item, i) => (
                <motion.div key={i} ref={el => {itemRefs.current[i] = el}} className={`relative h-fit`}
                    >
                    {isOpenInlineMenu && (
                        <AnimatePresence mode='wait'>
                            <motion.div 
                            initial={{opacity: 0}}
                            animate={{opacity: 1}} 
                            transition={{duration: 0.2, ease:"easeInOut"}}
                            className={`absolute right-0 flex translate-y-[100%] h-[8px] bottom-0 w-full ease-in-out duration-200`}>
                                <div className='bg-[#b9bbb7] w-full h-full'></div>
                                <div className='absolute bottom-0 right-0 translate-x-[100%] overflow-hidden w-[14px] h-[14px]'>
                                    <div id='sh-filter-menu' className={`rounded-bl-[14px]`}></div>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    )}
                    
                    <motion.div onClick={() => setOpenInlineMenu(!isOpenInlineMenu)} 
                    className={`cursor-pointer px-8 py-2 text-[clamp(15px,1.4vw,17px)] font-medium`}
                    initial={{backgroundColor: "#000000", color: "#ffffff", borderRadius: "20px"}}
                    animate={isOpenInlineMenu ? {backgroundColor: "#b9bbb7", color: "#000000", borderRadius: "20px 20px 0 0"}:{backgroundColor: "#000000", color: "#ffffff", borderRadius: "20px"}}
                    transition={{duration: 0.2, ease:"easeInOut"}}
                    >
                        <p >{item.label}</p>
                    </motion.div>
                    {isOpenInlineMenu && (
                        <AnimatePresence mode='wait' >
                        <motion.div ref={menuRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{opacity:0}} transition={{duration:0.2, ease:"easeInOut"}} className='bg-[#b9bbb7] absolute top-[calc(100%+8px)] rounded-b-[12px] px-5 space-y-3 py-3 rounded-r-[12px] flex flex-col'>
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
                                            isSelectedList?.find(Sitem => Sitem._id === item._id && Sitem.selected.some(SSitem=>SSitem._id === Fitem._id )) ? "bg-black":"bg-white"
                                        }`}>
                                            <Check className='w-[12px] h-[12px] text-white'/>
                                        </div>
                                        <p className="text-black rounded-md text-[14px] inline w-fit">
                                            {Fitem.value}
                                        </p>
                                    </label>
                                ))}
                                <div onClick={() => changeFilter(isSelectedList)} className="cursor-pointer bg-black text-white px-4 flex justify-center py-[6px] rounded-[12px] font-poppins text-[14px] font-medium">Zatwierdź</div>
                        </motion.div>
                        </AnimatePresence>
                    )}
                </motion.div>
            ))}
            <div onClick={()=>setOpenMenu(true)} className={`md:bg-[#b9bbb7] bg-black md:mb-2 cursor-pointer py-2 text-[clamp(15px,1.4vw,17px)] md:text-black text-white font-medium whitespace-nowrap border-black border-1 ${!miniSize ? "px-8 rounded-[20px]":"px-4 rounded-[16px]"}`}>{!mobileSize ? "Więcej.." : !miniSize ? "Filtruj" : (
                <div className='xs:py-[3px] py-[2px]'><FilterIcon className="w-[15px] h-[15px] text-white"/></div>
            )}</div>

        </div>
    </div>
  )
}

export default SubcategoryFilterContainer