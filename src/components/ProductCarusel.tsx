'use client'
import { client } from '@/sanity/lib/client'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Product } from '../../sanity.types'
import ProductItem from './ProductItem'
import { useScroll, useSpring, motion, useTransform } from 'framer-motion'

const ProductCarusel = () => {
    const [products, setProducts] = useState([])
    const [loading,setLoading] = useState<boolean>(true)
    const query = `*[_type == "product" && references(*[ _type == "category" && (slug.current == $slug || slug == $slug) ]._id)
        ]`
    const params = {slug : "zabawki"}
    const rangeRef = React.useRef<HTMLInputElement>(null);
    const carouselRef = React.useRef<HTMLDivElement>(null);

    const {scrollX, scrollXProgress} = useScroll({
        container: carouselRef,
        
    })  

    const smoothProgress = useSpring(scrollXProgress, { stiffness: 100, damping: 20 });
    const opacity = useTransform(smoothProgress, [0.7, 1], [1, 0]);
    const opacity2 = useTransform(smoothProgress, [0, 0.3], [0, 1]);

     useEffect(() => {
    return smoothProgress.on("change", (latest) => {
      const percentage = latest * 100 < 20 ? 20 : latest * 100; // przeliczamy 0–1 → 0–100%
      if (rangeRef.current) {
        rangeRef.current.style.setProperty("width", `${percentage}%`);
      }
    });
  }, [smoothProgress]);

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

    const handleClickNext = () => {
        if (carouselRef.current) {
          carouselRef.current.scrollBy({ left: 300, behavior: 'smooth' });
        }
    }

    const handleClickPrev = () => {
        if (carouselRef.current) {
          carouselRef.current.scrollBy({ left: -300, behavior: 'smooth' });
        }
    }

    return (
    <div className='w-full h-auto font-poppins lg:mt-12 mt-8'>
        <div className='flex justify-between lg:mx-25 md:mx-18 mx-10 lg:mb-11 mb-8'>
            <div className='flex flex-col'>
                <h1 className='text-black text-[clamp(13px,2vw,30px)] '>Produkty objęte promocją: </h1>
                <h1 className='text-black font-bold text-[clamp(13px,2vw,30px)]'>Znajdź psi przysmak</h1>
            </div>
            <div className='inline-flex h-fit justify-center items-center space-x-3 3xs:px-6 px-4 lg:py-3 py-2 bg-[#A7E4D9] rounded-[15px] xl:mt-8'><p className='text-black text-[clamp(10px,2.1vw,20px)] font-bold'>Zobacz więcej</p><ArrowRight className='text-black lg:w-[24px] w-[20px] lg:h-[24px] h-[20px]'/></div>
        </div>
        <div className='w-full flex flex-col items-center'>
            <div className='w-full flex relative '>
                <div ref={carouselRef} className='carousel w-full lg:pl-25 md:pl-18 pl-10 lg:pr-25 md:pr-18 pr-10 overflow-x-scroll flex justify-start'>
                    <motion.div style={{opacity:opacity2}} whileHover={{scale:0.9}} onClick={()=> handleClickPrev()} className='absolute z-10 left-6 p-3 rounded-[20px] bg-white top-[50%] translate-y-[-50%] cursor-pointer'><ChevronLeft className='text-black'/></motion.div>
                    <div className='flex 1xl:space-x-10 lg:space-x-7 space-x-5 w-auto h-auto'>
                        {
                            loading ? <span>Products is loading...</span> :
                            products?.map((item:Product)=>(
                                <ProductItem product={item} key={item?._id}/>
                            ))
                        }
                    </div>
                    <motion.div style={{opacity}} whileHover={{scale:0.9}} onClick={()=> handleClickNext()} className='absolute z-10 right-6 p-3 rounded-[20px] bg-white top-[50%] translate-y-[-50%] cursor-pointer'><ChevronRight className='text-black'/></motion.div>
                </div>
            </div>
            <div className='bg-[#BDBDBD] w-[40vw] h-[3px] rounded-full lg:mt-20 mt-12'>
                <div ref={rangeRef} className='bg-[#383838] h-full rounded-full' style={{ width: 'var(--thumb-size, 10%)' }}></div>
            </div>
        </div>
    </div>
  )
}

export default ProductCarusel