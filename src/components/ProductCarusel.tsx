'use client'
import { client } from '@/sanity/lib/client'
import { ArrowRight } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Product } from '../../sanity.types'
import ProductItem from './ProductItem'

const ProductCarusel = () => {
    const [products, setProducts] = useState([])
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
    },[])
    return (
    <div className='w-full h-auto font-poppins lg:mt-12 mt-8'>
        <div className='flex justify-between lg:mx-25 md:mx-18 mx-10 lg:mb-11 mb-8'>
            <div className='flex xl:flex-row flex-col'>
                <h1 className='text-black text-[clamp(13px,2vw,30px)] '>Produkty objęte promocją: </h1>
                <h1 className='text-black font-bold text-[clamp(13px,2vw,30px)] xl:ml-5'>Znajdź psi przysmak</h1>
            </div>
            <div className='inline-flex h-fit justify-center items-center space-x-3 px-6 lg:py-3 py-2 bg-[#A7E4D9] rounded-[15px] xl:mt-8'><p className='text-black text-[clamp(12px,1.4vw,20px)] font-bold'>Zobacz więcej</p><ArrowRight className='text-black lg:w-[24px] w-[20px] lg:h-[24px] h-[20px]'/></div>
        </div>
        <div className='w-full flex flex-col items-center'>
            <div className='w-full lg:pl-25 md:pl-18 pl-10 overflow-x-hidden flex justify-start'>
                <div className='flex lg:space-x-10 space-x-5 w-auto h-auto lg:mb-20 mb-12'>
                    {
                        loading ? <span>Products is loading...</span> :
                        products?.map((item:Product)=>(
                            <ProductItem product={item} key={item?._id}/>
                        ))
                    }
                </div>
            </div>
            <input id='item-progress-bar' type='range'/>
        </div>
    </div>
  )
}

export default ProductCarusel