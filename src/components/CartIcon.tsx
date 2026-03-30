"use client"
import { urlFor } from '@/sanity/lib/image'
import { Check, ShoppingBagIcon } from 'lucide-react'
import Image from 'next/image'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import useCartStore from 'store'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'

type Props = {
    mode: number
}

const CartIcon = ({ mode }: Props) => {
    const { getGroupedItems } = useCartStore()
    const itemCount = getGroupedItems()

    const setOnItemAdded = useCartStore((state) => state.setOnItemAdded)

    // The item that triggered the popup — set directly from the callback
    const [popupItem, setPopupItem] = useState<any>(null)
    const [isVisible, setIsVisible] = useState(false)
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
            popupRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
    }, [])

    // Register the callback once; it fires whenever an item is added to cart
    useEffect(() => {
        setOnItemAdded((item) => {
            setPopupItem(item)
            setIsVisible(true)
            // Let the DOM update before scrolling
            requestAnimationFrame(() => {
                requestAnimationFrame(scrollToPopup)
            })
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

    const variantsProperties = popupItem?.product.variants?.find(
        (v: any) => v._key === popupItem.variant
    )

    return (
        <div
            className={`px-1.5 py-2 relative ease-in-out duration-300 ${
                isVisible ? 'bg-[#2C2C2C] rounded-t-full' : ''
            }`}
        >   <Link href={"/cart"}>
                <ShoppingBagIcon
                    className={`lg:min-w-[27px] min-w-[25px] lg:h-[27px] h-[25px] stroke-[1.4px] ${
                        mode === 1 ? 'text-black' : 'text-white'
                    } ${isVisible ? 'text-white' : ''}`}
                />
            </Link>
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
                        className="absolute top-[100%] left-0 bg-[#2C2C2C] w-full h-[10px]"
                    >
                        {/* Corner filler */}
                        <div className="absolute w-full h-[20px] left-[-100%] top-[-10px] overflow-hidden">
                            <div className="absolute top-0 right-0 w-full h-full sh-rounded-product-card rounded-br-[30px]" />
                        </div>

                        {/* Popup body */}
                        <div className="absolute top-[100%] py-3 px-4 space-y-2 right-0 bg-[#2C2C2C] rounded-tl-[30px] rounded-b-[30px] w-auto min-w-[100px] h-auto min-h-[100px] flex flex-col">
                            <div className="flex p-1">
                                <Check className="text-white w-[20px] h-[20px]" />
                                <h1 className="text-white ml-2 text-[clamp(12px,1.3vw,16px)] text-nowrap">
                                    Pomyślnie dodano do koszyka
                                </h1>
                            </div>

                            <div className="flex space-x-3 w-full">
                                <div className="w-auto">
                                    {popupItem?.product.images && (
                                        <Image
                                            src={urlFor(popupItem.product.images[0]).url()}
                                            alt="Product Image"
                                            className="min-w-[117px] h-[117px]"
                                            width={117}
                                            height={117}
                                        />
                                    )}
                                </div>

                                <div className="text-[clamp(12px,1.3vw,16px)] w-auto min-w-[170px]">
                                    <p className="line-clamp-1 text-white">{popupItem?.product.title}</p>

                                    {variantsProperties?.optionValues?.map((item: any, index: number) => (
                                        <div key={index} className="text-[#ABABAB] flex space-x-2">
                                            <p>{item.name?.label}</p>
                                            <p>{item.value?.value}</p>
                                        </div>
                                    ))}

                                    <p className="line-clamp-1 text-[clamp(12px,1.3vw,16px)] text-white">
                                        Ilość: {popupItem?.quantity}
                                    </p>
                                    <p className="line-clamp-1 text-[clamp(12px,1.3vw,16px)] text-white">
                                        {popupItem?.product.price?.toLocaleString('pl-PL', {
                                            style: 'currency',
                                            currency: 'PLN',
                                        })}{' '}
                                        {Number(popupItem?.quantity) > 1 &&
                                            `x ${popupItem?.quantity} = `}
                                        {(
                                            Number(popupItem?.quantity) *
                                            Number(popupItem?.product.price)
                                        ).toLocaleString('pl-PL', {
                                            style: 'currency',
                                            currency: 'PLN',
                                        })}
                                    </p>
                                </div>
                            </div>

                            <Link href={"/cart"} className="bg-fancy-black w-full py-2 flex justify-center rounded-[20px] text-white font-bold text-[clamp(12px,1.3vw,16px)] mt-1 cursor-pointer">
                                Przejdź do koszyka
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default CartIcon