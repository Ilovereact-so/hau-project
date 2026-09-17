"use client"
import { ShoppingBagIcon } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import useCartStore from 'store'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { effectivePrice } from '@/lib/omnibus'

type Props = {
    mode: number
}

const CartIcon = ({ mode }: Props) => {
    const setOnItemAdded = useCartStore((state) => state.setOnItemAdded)

    // The item that triggered the popup — set directly from the callback
    const [popupItem, setPopupItem] = useState<any>(null)
    // Gdzie pokazać popup — przychodzi z AddToCartButton przez addItem → onItemAdded
    const [popupPosition, setPopupPosition] = useState<'top' | 'bottom'>('bottom')
    const [isVisible, setIsVisible] = useState(false)
    // createPortal potrzebuje document — portal włączamy dopiero po montażu,
    // przy SSR popup (gdyby był widoczny od razu) renderuje się inline
    const [mounted, setMounted] = useState(false)
    const isMouseOverRef = useRef(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const popupRef = useRef<HTMLDivElement>(null)

    const clearHideTimer = useCallback(() => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }
    }, [])

    const scheduleHide = useCallback(() => {
        clearHideTimer()
        timerRef.current = setTimeout(() => {
            if (!isMouseOverRef.current) {
                setIsVisible(false)
            }
        }, 2000)
    }, [clearHideTimer])

    const scrollToPopup = useCallback(() => {
        if (popupRef.current) {
            popupRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }, [])

    useEffect(() => setMounted(true), [])

    // Register the callback once; it fires whenever an item is added to cart
    useEffect(() => {
        setOnItemAdded((item, type = 'top') => {
            setPopupItem(item)
            setPopupPosition(type as 'top' | 'bottom')
            setIsVisible(true)
            // Scroll ma sens tylko przy popupie w topie (przy ikonce koszyka) —
            // wersja "bottom" jest fixed względem window, więc scrollowanie zbędne
            if (type !== 'bottom') {
                // Let the DOM update before scrolling
                requestAnimationFrame(() => {
                    requestAnimationFrame(scrollToPopup)
                })
            }
            scheduleHide()
        })

        return () => setOnItemAdded(null)
    }, [setOnItemAdded, scheduleHide, scrollToPopup])

    const handleMouseEnter = useCallback(() => {
        isMouseOverRef.current = true
        clearHideTimer()
    }, [clearHideTimer])

    const handleMouseLeave = useCallback(() => {
        isMouseOverRef.current = false
        // Restart 2s countdown from the moment the mouse leaves
        scheduleHide()
    }, [scheduleHide])

    // Cena jak w koszyku: wariant → produkt (wcześniej zawsze cena produktu).
    const popupUnitPrice = effectivePrice(popupItem?.product, popupItem?.variant) ?? 0
    const variantsProperties = popupItem?.product.variants?.find(
        (v: any) => v._key === popupItem.variant
    )

    // Wspólny node popupu — przy "top" renderowany inline (przy ikonce w headerze),
    // przy "bottom" przenoszony portalem do <body>, żeby `fixed` zależał wyłącznie
    // od okna (nawet gdy jakiś przodek ma transform/filter)
    const popup = (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    ref={popupRef}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    style={{ scrollMarginTop: '20px' }}
                    className={
                        popupPosition === 'bottom'
                            ? 'fixed bottom-4 right-4 z-[100]'
                            : 'absolute top-[100%] left-0 bg-[#ededed] w-full h-[10px] z-11'
                    }
                >
                        {/* Corner filler — tylko tryb top (wystaje nad header) */}
                        {popupPosition !== 'bottom' && (
                            <div className="absolute w-full h-[20px] left-[-100%] top-[-10px] overflow-hidden">
                                <div className="absolute top-0 right-0 w-full h-full sh-rounded-product-card2 rounded-br-[30px]" />
                            </div>
                        )}

                        {/* Popup body */}
                        <div className={
                            popupPosition === 'bottom'
                                ? 'py-4 px-6 space-y-2 bg-[#ededed] rounded-[30px] shadow-lg w-auto min-w-[320px] h-auto min-h-[100px] flex flex-col'
                                : 'absolute top-[100%] py-4 px-6 space-y-2 md:right-0 right-[-70px] bg-[#ededed] rounded-tl-[30px] max-md:rounded-tr-[30px] rounded-b-[30px] w-auto min-w-[320px] h-auto min-h-[100px] flex flex-col'
                        }>
                            {/* <div className="flex p-1 justify-center items-center space-x-2">
                                <Check className="text-white w-[20px] h-[20px]" />
                                <h1 className="text-white text-[18px] text-nowrap">
                                    Pomyślnie dodano do koszyka
                                </h1>
                            </div> */}
                            <div className="text-[clamp(12px,1.3vw,16px)] w-auto min-w-[170px] p-1 text-fancy-black font-poppins">
                                <p className="sm:text-[16px] text-[14px]">{popupItem?.product.brand}</p>
                                <p className="line-clamp-1 sm:text-[18px] text-[16px] font-medium">{popupItem?.product.title}</p>
                                                                
                                

                                <div className='flex space-x-2 mt-1'>
                                    {variantsProperties?.optionValues?.map((item: any, index: number) => (
                                        <div key={index} className="text-[#6C6C6C] sm:text-[16px] text-[14px] flex space-x-1">
                                            <p>{item.name?.label}</p>
                                            <p>{item.value?.value}</p>
                                            { variantsProperties?.optionValues.length -1 != index && <p>|</p>}
                                        </div>
                                    ))}
                                </div>

                                <p className="line-clamp-1 sm:text-[16px] text-[14px] text-fancy-black mt-2">
                                    Ilość: {popupItem?.quantity} szt.
                                </p>
                                <p className="line-clamp-1 sm:text-[16px] text-[14px] text-fancy-black">
                                    Suma:{' '}
                                    {popupUnitPrice.toLocaleString('pl-PL',{
                                        style: 'currency',
                                        currency: 'PLN',
                                    })}{' '}
                                    {Number(popupItem?.quantity) > 1 &&
                                        `x ${popupItem?.quantity} szt. = `}
                                    {(
                                        Number(popupItem?.quantity) *
                                        popupUnitPrice
                                    ).toLocaleString('pl-PL', {
                                        style: 'currency',
                                        currency: 'PLN',
                                    })}
                                </p>
                            </div>
                            

                            <Link href={"/cart"} className="bg-fancy-black w-full py-2 flex justify-center rounded-[20px] text-white font-medium text-[clamp(12px,1.3vw,16px)] mt-2 cursor-pointer font-poppins">
                                Przejdź do koszyka
                            </Link>
                        </div>
                    </motion.div>
                )}
        </AnimatePresence>
    )

    return (
        <div
            className={`px-1.5 relative ease-in-out duration-300 font-poppins ${
                isVisible ? 'bg-[#ededed] rounded-t-full py-2' : 'lg:pr-4.5 pr-3.5 lg:py-3 py-2.5'
            }`}
        >
            <Link href={"/cart"}>
                <ShoppingBagIcon
                    className={`lg:min-w-[27px] min-w-[25px] lg:h-[27px] h-[25px] stroke-[1.4px] hover:text-main ease-in-out duration-150 transition-colors ${
                        mode === 1 ? 'sm:text-black text-white' : 'text-white'
                    } ${isVisible ? 'text-white' : ''}`}
                />
            </Link>
            {/* Portal tylko dla "bottom" — i dopiero po montażu (document nie istnieje
                przy SSR, a mounted chroni też przed hydromismatch przy starcie) */}
            {mounted && popupPosition === 'bottom'
                ? createPortal(popup, document.body)
                : popup}
        </div>
    )
}

export default CartIcon