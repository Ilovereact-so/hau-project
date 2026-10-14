'use client'
import { ArrowRight } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { GetSlugProduct } from '../../sanity.types'
import ProductItem from './ProductItem'
import Carousel from './Carousel'
import { twMerge } from 'tailwind-merge'
import { getCarouselProduct } from '@/sanity/helpers/clientRequest'
import { ProductCardRowSkeleton } from './ui/Skeleton'

type Props =  {
    title : string,
    subtitle : string,
    className?: string
    // Slug kategorii Sanity, którego produkty ma pokazać karuzela. Wcześniej
    // był na sztywno wpisany "feeding" w useEffect poniżej — niezależnie od
    // tego, jaki `title`/`subtitle` dostał komponent, zawsze renderowały się
    // te same produkty. Domyślna wartość zostaje "feeding", żeby nie zmieniać
    // zachowania istniejących wywołań bez zmiany propsów.
    categorySlug?: string
}

const ProductCarusel = ({title, subtitle, className, categorySlug = 'feeding'}:Props) => {
    const [products, setProducts] = useState<GetSlugProduct[]>([])
    const [loading, setLoading] = useState<boolean>(true)

    useEffect(() => {
        setLoading(true)
        getCarouselProduct(categorySlug).then((data) => {
            setProducts(data)
            setLoading(false)
        })
    }, [categorySlug])

    return (
    <div className={twMerge('w-full h-auto font-poppins lg:mt-12 mt-8', className)}>
        <div className='flex justify-between items-start lg:mx-25 md:mx-18 mx-10 lg:mb-11 mb-8'>
            <div className='flex md:flex-row flex-col md:space-x-2 max-md:space-y-0'>
                <h2 className='text-black sm:text-[clamp(16px,1.9vw,30px)] text-[16px] '>{title}: </h2>
                <p className='text-black font-bold sm:text-[clamp(16px,1.9vw,30px)] text-[16px]'>{subtitle}</p>
            </div>
            <div className='inline-flex h-fit max-sm:w-min justify-center sm:items-start items-center space-x-2 sm:px-5 px-2 lg:py-3 py-2 border-1 border-black bg-transparent rounded-[15px] '>
                <p className='text-black text-[clamp(13px,1.3vw,20px)] font-bold max-sm:hidden'>Zobacz więcej</p>
                <ArrowRight className='text-black lg:w-[24px] w-[20px] lg:h-[24px] h-[20px]'/>
            </div>
        </div>
        <Carousel>
            <div className='flex 1xl:space-x-10 lg:space-x-7 space-x-5 w-auto h-auto'>
                {
                    // Szkielety w gapie starej karuzeli (ProductItem) — patrz
                    // components/ui/Skeleton.tsx.
                    loading ? <ProductCardRowSkeleton count={4} gap="1xl:space-x-10 lg:space-x-7 space-x-5" /> :
                    products.map((item: GetSlugProduct)=>(
                        <ProductItem product={item} key={item?._id}/>
                    ))
                }
            </div>
        </Carousel>
    </div>
  )
}

export default ProductCarusel