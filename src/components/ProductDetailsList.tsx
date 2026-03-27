'use client'
import React, { useState } from 'react'
import { GetSlugProduct, Product } from '../../sanity.types'
import { ChevronDown } from 'lucide-react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { twMerge } from 'tailwind-merge'


type Props = {
    product : GetSlugProduct,
    className : string
}
const ProductDetailsList = ({product, className}:Props) => {
  const [isOpen, setOpen] = useState<number>(1)

  return (
    <div className={twMerge(' mt-4', className)}>
        <div className='flex flex-col font-poppins '>
            <div onClick={()=> isOpen == 1 ? setOpen(1) : setOpen(1)} className='flex justify-between items-center lg:px-6 py-4 w-full text-black text-[clamp(16px,1.6vw,20px)] cursor-pointer'>
                <h1 className='font-medium'>Materiał</h1>
                <ChevronDown/>
            </div>
            <motion.div initial={{maxHeight: 0}} animate={isOpen == 1 ? {maxHeight: 300}:{maxHeight:0, paddingTop:0,paddingBottom:0}} transition={{duration:0.4}} className='flex flex-col font-poppins text-black lg:px-6 py-1 pb-5 overflow-hidden'>
                <h1 className='text-[16px] font-medium'>Materiał: <span className='font-normal'>{product?.material}</span></h1>
                <h1 className='text-[16px] font-medium'>Wodoodporny: <span className='font-normal'>{product?.isWaterproof ? "Tak" : "Nie"}</span></h1>
                <h1 className='text-[16px] font-medium mt-5 w-auto'>Instrukcje czyszczenia: <span className='font-normal'>{product?.care}</span></h1>
                <Image src='/WashIcon0.svg' width={100} height={25} alt='Nie wkładać do pralki' className='w-[29px] h-[25px] box-border mt-2'/>
            </motion.div>
        </div>
        <hr className='bg-black h-[1px] mx-1'></hr>
        <div>
            <div onClick={()=> isOpen == 2 ? setOpen(1) : setOpen(2)} className='flex justify-between items-center lg:px-6 py-4 w-full text-black text-[clamp(16px,1.6vw,20px)] cursor-pointer'>
                <h1 className='font-medium'>Szczegóły produktu</h1>
                <ChevronDown/>
            </div>
            <motion.div initial={{maxHeight: 0}} animate={isOpen == 2 ? {maxHeight: 300}:{maxHeight:0, paddingTop:0,paddingBottom:0}} transition={{duration:0.4}} className='flex flex-col font-poppins text-black lg:px-6 py-1 pb-5 overflow-hidden'>
                <h1 className='text-[16px] font-medium'>Numer produktu: <span className='font-normal'>{product?.sku}</span></h1>
                <h1 className='text-[16px] font-medium mt-1'>Wymiary: <br/>
                <span className='font-normal pl-5'>
                {product?.dimensions?.width_cm} x {product?.dimensions?.height_cm} x {product?.dimensions?.depth_cm} {product?.dimensions?.unit};<br/>
                <span className='font-normal pl-5'>szerokość x wysokość x głębokość;</span> <br/>
                <span className='font-normal pl-5'>jednostka: {product?.dimensions?.unit};</span>
                </span></h1>
                <h1 className='text-[16px] font-medium mt-2 w-auto'>Waga: <span className='font-normal'>{product?.weight_g}g</span></h1>
            </motion.div>
        </div>
        <hr className='bg-black h-[1px] mx-1'></hr>
        <div>
            <div onClick={()=> isOpen == 3 ? setOpen(1) : setOpen(3)} className='flex justify-between items-center lg:px-6 py-4 w-full text-black text-[clamp(16px,1.6vw,20px)] cursor-pointer'>
                <h1 className='font-medium'>Producent</h1>
                <ChevronDown/>
            </div>
            <motion.div initial={{maxHeight: 0}} animate={isOpen == 3 ? {maxHeight: 300}:{maxHeight:0, paddingTop:0,paddingBottom:0}} transition={{duration:0.4}} className='flex flex-col font-poppins text-black lg:px-6 py-1 pb-5 overflow-hidden'>
                <h1 className='text-[16px] font-medium'>Numer produktu: <span className='font-normal'>{product?.sku}</span></h1>
                <h1 className='text-[16px] font-medium mt-1'>Wymiary: <br/>
                <span className='font-normal pl-5'>
                {product?.dimensions?.width_cm} x {product?.dimensions?.height_cm} x {product?.dimensions?.depth_cm} {product?.dimensions?.unit};<br/>
                <span className='font-normal pl-5'>szerokość x wysokość x głębokość;</span> <br/>
                <span className='font-normal pl-5'>jednostka: {product?.dimensions?.unit};</span>
                </span></h1>
                <h1 className='text-[16px] font-medium mt-2 w-auto'>Waga: <span className='font-normal'>{product?.weight_g}g</span></h1>
            </motion.div>
        </div>
    </div>
  )
}

export default ProductDetailsList