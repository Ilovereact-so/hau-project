'use client'
import { client } from '@/sanity/lib/client'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { GetSlugProduct, Product } from '../../sanity.types'
import ProductItem from './ProductItem'
import Carousel from './Carousel'
import { twMerge } from 'tailwind-merge'
import { getCarouselProduct } from '@/sanity/helpers/clientRequest'
import ProductItem2 from './ProductItem2'

type Props =  {
    title : string,
    className?: string  
}

const ProductCarusel2 = ({title, className}:Props) => {
    const [products, setProducts] = useState<GetSlugProduct[]>([])
    const [loading, setLoading] = useState<boolean>(true)

    useEffect(() => {
        getCarouselProduct("feeding").then((data) => {
            setProducts(data)
            setLoading(false)
        })
    }, [])


    const leftChevronRef = React.useRef<HTMLDivElement>(null);
    const rightChevronRef = React.useRef<HTMLDivElement>(null);
    return (
    <div className={twMerge('w-full h-auto font-poppins lg:mt-12 mt-8', className)}>
        <div className='flex justify-between items-start lg:mx-15 mx-10 mb-6'>
            <div className='flex md:flex-row flex-col md:space-x-2 max-md:space-x-0'>
                <h1 className='text-black sm:text-[clamp(16px,1.9vw,24px)] text-[16px] font-medium'>{title}: </h1>
            </div>
            <div className='flex space-x-3'>
                <div ref={leftChevronRef} className='w-[50px] h-[50px] flex justify-center items-center bg-[#EDEDED] rounded-full cursor-pointer hover:bg-[#E1E1E1] transition-colors duration-300'>
                    <ChevronLeft className='text-black w-[24px] h-[24px]'/>
                </div>
                <div ref={rightChevronRef} className='w-[50px] h-[50px] flex justify-center items-center bg-[#EDEDED] rounded-full cursor-pointer hover:bg-[#E1E1E1] transition-colors duration-300'>
                    <ChevronRight className='text-black w-[24px] h-[24px]'/>
                </div>
            </div>
        </div>
        <Carousel rightBtn={rightChevronRef} leftBtn={leftChevronRef}>
            <div className='flex space-x-[18px] w-auto h-auto '>
                {
                    loading ? <span>Products is loading...</span> :
                    products.map((item: GetSlugProduct)=>(
                        <ProductItem2 product={item} key={item?._id}/>
                    ))
                }
            </div>
        </Carousel>
    </div>
  )
}

export default ProductCarusel2