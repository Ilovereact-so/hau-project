'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { GetSlugProduct } from '../../sanity.types'
import Carousel from './Carousel'
import { twMerge } from 'tailwind-merge'
import { getCarouselProduct } from '@/sanity/helpers/clientRequest'
import { ProductCardRowSkeleton } from './ui/Skeleton'
import ProductItem2 from './ProductItem2'
import Container from './Container'
import Link from 'next/link'

type Props =  {
    title : string,
    className?: string
    // Patrz komentarz przy tym samym propie w ProductCarusel.tsx — wcześniej
    // "feeding" było na sztywno wpisane tutaj, więc WSZYSTKIE karuzele na
    // stronie głównej (3x <ProductCarusel2 /> w ContentContainer.tsx, każda z
    // innym `title`) i ta w (client)/layout.tsx pokazywały identyczne
    // produkty i odpalały identyczne zapytanie do Sanity równolegle.
    categorySlug?: string
    /** Gotowa lista z serwera (strona główna, lib/homeLayout.server.ts) — bez zapytania z przeglądarki. */
    products?: GetSlugProduct[]
    subtitle?: string
    /** Link „Zobacz wszystkie” (strona kolekcji / subkategorii). */
    moreHref?: string | null
}

const ProductCarusel2 = ({title, className, categorySlug = 'feeding', products: initialProducts, subtitle, moreHref}:Props) => {
    const [products, setProducts] = useState<GetSlugProduct[]>(initialProducts ?? [])
    const [loading, setLoading] = useState<boolean>(!initialProducts)

    useEffect(() => {
        if (initialProducts) {
            setProducts(initialProducts)
            setLoading(false)
            return
        }
        setLoading(true)
        getCarouselProduct(categorySlug).then((data) => {
            setProducts(data)
            setLoading(false)
        })
    }, [categorySlug, initialProducts])


    const leftChevronRef = React.useRef<HTMLDivElement>(null);
    const rightChevronRef = React.useRef<HTMLDivElement>(null);
    return (
    <Container className={twMerge('w-full h-auto font-poppins lg:mt-12 mt-8', className)}>
        <div className='flex justify-between sm:items-end items-center lg:mx-15 sm:mx-10 mx-6 mb-6'>
            <div className='flex flex-col'>
                <h2 className='text-black sm:text-[clamp(16px,1.9vw,20px)] text-[16px]'>{title}: </h2>
                {subtitle && <p className='text-[#6C6C6C] sm:text-[14px] text-[13px] mt-0.5'>{subtitle}</p>}
                {moreHref && (
                    <Link href={moreHref} className='text-black sm:text-[14px] text-[13px] underline underline-offset-2 hover:opacity-70 mt-1 w-fit'>
                        Zobacz wszystkie
                    </Link>
                )}
            </div>
            <div className='flex space-x-3'>
                <div ref={leftChevronRef} className='md:w-[50px] md:h-[50px] sm:w-[40px] sm:h-[40px] w-[34px] h-[34px] flex justify-center items-center bg-[#ededed] border-[#E4E9E7] hover:border-transparent border rounded-full cursor-pointer hover:bg-[#e2f3f0] transition-colors duration-300'>
                    <ChevronLeft className='text-black md:w-[24px] sm:w-[20px] w-[18px] md:h-[24px] sm:h-[20px] h-[18px]'/>
                </div>
                <div ref={rightChevronRef} className='md:w-[50px] md:h-[50px] sm:w-[40px] sm:h-[40px] w-[34px] h-[34px] flex justify-center items-center bg-[#ededed] border-[#EDEDED] hover:border-transparent border rounded-full cursor-pointer hover:bg-[#e2f3f0] transition-colors duration-300'>
                    <ChevronRight className='text-black md:w-[24px] sm:w-[20px] w-[18px] md:h-[24px] sm:h-[20px] h-[18px]'/>
                </div>
            </div>
        </div>
        <Carousel rightBtn={rightChevronRef} leftBtn={leftChevronRef}>
            <div className='flex md:space-x-[18px] space-x-[14px] w-auto h-auto '>
                {
                    // Szkielety zamiast napisu "Products is loading..." — kafelki mają
                    // te same szerokości co ProductItem2, więc po dojściu danych nic
                    // się nie przeskoczy (patrz components/ui/Skeleton.tsx).
                    loading ? <ProductCardRowSkeleton count={4} /> :
                    products.map((item: GetSlugProduct)=>(
                        <ProductItem2 product={item} key={item?._id}/>
                        // <ProductItemWithoutBTN product={item} key={item?._id}/>
                    ))
                }
            </div>
        </Carousel>
    </Container>
  )
}

export default ProductCarusel2