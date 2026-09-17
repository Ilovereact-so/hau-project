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

type Props =  {
    title : string,
    className?: string
    // Patrz komentarz przy tym samym propie w ProductCarusel.tsx — wcześniej
    // "feeding" było na sztywno wpisane tutaj, więc WSZYSTKIE karuzele na
    // stronie głównej (3x <ProductCarusel2 /> w ContentContainer.tsx, każda z
    // innym `title`) i ta w (client)/layout.tsx pokazywały identyczne
    // produkty i odpalały identyczne zapytanie do Sanity równolegle.
    categorySlug?: string
}

const ProductCarusel2 = ({title, className, categorySlug = 'feeding'}:Props) => {
    const [products, setProducts] = useState<GetSlugProduct[]>([])
    const [loading, setLoading] = useState<boolean>(true)

    useEffect(() => {
        setLoading(true)
        getCarouselProduct(categorySlug).then((data) => {
            setProducts(data)
            setLoading(false)
        })
    }, [categorySlug])


    const leftChevronRef = React.useRef<HTMLDivElement>(null);
    const rightChevronRef = React.useRef<HTMLDivElement>(null);
    return (
    <Container className={twMerge('w-full h-auto font-poppins lg:mt-12 mt-8', className)}>
        <div className='flex justify-between sm:items-end items-center lg:mx-15 sm:mx-10 mx-6 mb-6'>
            <div className='flex md:flex-row flex-col md:space-x-2 max-md:space-x-0'>
                <h1 className='text-black sm:text-[clamp(16px,1.9vw,20px)] text-[16px]'>{title}: </h1>
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