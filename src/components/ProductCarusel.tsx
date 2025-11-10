'use client'
import { client } from '@/sanity/lib/client'
import { ArrowRight } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Product } from '../../sanity.types'
import ProductItem from './ProductItem'
import Carousel from './Carousel'

type Props =  {
    title : string,
    subtitle : string
}
const ProductCarusel = ({title, subtitle}:Props) => {
    const [products, setProducts] = useState<Product[]>([]) 
    const [loading,setLoading] = useState<boolean>(true)
    const query = `*[_type == "product" && references(*[ _type == "category" && (slug.current == $slug || slug == $slug) ]._id)
        ]`
    const params = {slug : "zabawki"}

    useEffect(()=>{
        const fetchData = async ()=>{
            setLoading(true)
            try{
                const response = await client.fetch(query,params)
                setProducts(await response)
            } catch (error){
                console.log("Product fetching Error", error)
            } finally{
                setLoading(false)
            }
        }
        fetchData();
    },[query, params])

    return (
    <div className='w-full h-auto font-poppins lg:mt-12 mt-8'>
        <div className='flex justify-between lg:mx-25 md:mx-18 mx-10 lg:mb-11 mb-8'>
            <div className='flex flex-col'>
                <h1 className='text-black text-[clamp(13px,2vw,30px)] '>{title}: </h1>
                <h1 className='text-black font-bold text-[clamp(13px,2vw,30px)]'>{subtitle}</h1>
            </div>
            <div className='inline-flex h-fit justify-center items-center space-x-3 3xs:px-6 px-4 lg:py-3 py-2 bg-[#A7E4D9] rounded-[15px] xl:mt-8'><p className='text-black text-[clamp(10px,2.1vw,20px)] font-bold'>Zobacz więcej</p><ArrowRight className='text-black lg:w-[24px] w-[20px] lg:h-[24px] h-[20px]'/></div>
        </div>
        <Carousel>
            <div className='flex 1xl:space-x-10 lg:space-x-7 space-x-5 w-auto h-auto'>
                {
                    loading ? <span>Products is loading...</span> :
                    products?.map((item:Product)=>(
                        <ProductItem product={item} key={item?._id}/>
                    ))
                }
            </div>
        </Carousel>
    </div>
  )
}

export default ProductCarusel