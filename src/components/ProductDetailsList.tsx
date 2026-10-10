'use client'
import React, { useState } from 'react'
import { GetSlugProduct } from '../../sanity.types'
import { ChevronDown } from 'lucide-react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { twMerge } from 'tailwind-merge'


type Props = {
    product : GetSlugProduct,
    className : string
}
const ProductDetailsList = ({product, className}:Props) => {
  // Krótki opis jest otwarty od razu — to pierwsza rzecz, którą klient czyta
  // obok ceny. Pełny opis jest niżej, pod zdjęciami (sekcja #opis).
  const [isOpen, setOpen] = useState<number>(product?.shortDescription ? 1 : 0)
  const hasLongDescription = Array.isArray(product?.description) && product.description.length > 0

  return (
    <div className={twMerge(' mt-10', className)}>
        <div className='flex flex-col font-poppins '>
            <div onClick={()=> isOpen == 1 ? setOpen(0) : setOpen(1)} className='flex justify-between items-center py-4 w-full text-black 2lg:text-[clamp(16px,1.6vw,18px)] text-[15px] cursor-pointer'>
                <h1 className=''>Opis</h1>
                <div className={`transform transition-transform duration-300 ${isOpen === 1 ? 'rotate-180' : ''}`}>
                    <ChevronDown width={20} height={20}/>
                </div>
            </div>
            <motion.div initial={false} animate={isOpen == 1 ? {height: 'auto'}:{height:0, paddingTop:0,paddingBottom:0}} transition={{duration:0.25}} className='flex flex-col font-poppins text-black  py-1 pb-5 overflow-hidden'>
                {product?.shortDescription && (
                  <p className="text-[#3A3A3A] 2lg:text-[16px] text-[15px] leading-relaxed whitespace-pre-line">{product.shortDescription}</p>
                )}
                {hasLongDescription && (
                  <a href="#opis" className="text-black 2lg:text-[15px] text-[14px] underline underline-offset-2 mt-2 w-fit hover:opacity-70">
                    Pełny opis produktu ↓
                  </a>
                )}
                {!product?.shortDescription && !hasLongDescription && (
                  <p className="text-[#6C6C6C] 2lg:text-[15px] text-[14px]">Opis pojawi się wkrótce.</p>
                )}
            </motion.div>
        </div>
        <hr className='bg-black h-[1px] mx-1'></hr>
        <div className='flex flex-col font-poppins '>
            <div onClick={()=> isOpen == 2 ? setOpen(0) : setOpen(2)} className='flex justify-between items-center py-4 w-full text-black 2lg:text-[clamp(16px,1.6vw,18px)] text-[15px] cursor-pointer'>
                <h1 className=''>Materiał</h1>
                <div className={`transform transition-transform duration-300 ${isOpen === 2 ? 'rotate-180' : ''}`}>
                    <ChevronDown width={20} height={20}/>
                </div>
            </div>
            <motion.div initial={{maxHeight: 0}} animate={isOpen == 2 ? {maxHeight: 300}:{maxHeight:0, paddingTop:0,paddingBottom:0}} transition={{duration:0.4}} className='flex flex-col font-poppins text-black  py-1 pb-5 overflow-hidden'>
                <h1 className='2lg:text-[16px] text-[15px]'>Materiał: <span className='text-[#6C6C6C]'>{product?.material}</span></h1>
                <h1 className='2lg:text-[16px] text-[15px]'>Wodoodporny: <span className='text-[#6C6C6C]'>{product?.isWaterproof ? "Tak" : "Nie"}</span></h1>
                <h1 className='2lg:text-[16px] text-[15px] mt-5 w-auto'>Instrukcje czyszczenia: <span className='text-[#6C6C6C]'>{product?.care}</span></h1>
                <Image src='/WashIcon0.svg' width={100} height={25} alt='Nie wkładać do pralki' className='w-[29px] h-[25px] box-border mt-2'/>
            </motion.div>
        </div>
        <hr className='bg-black h-[1px] mx-1'></hr>
        <div>
            <div onClick={()=> isOpen == 3 ? setOpen(0) : setOpen(3)} className='flex justify-between items-center py-4 w-full text-black 2lg:text-[clamp(16px,1.6vw,18px)] text-[15px] cursor-pointer'>
                <h1 className=''>Szczegóły produktu</h1>
                <div className={`transform transition-transform duration-300 ${isOpen === 3 ? 'rotate-180' : ''}`}>
                    <ChevronDown width={20} height={20}/>
                </div>
            </div>
            <motion.div initial={{maxHeight: 0}} animate={isOpen == 3 ? {maxHeight: 300}:{maxHeight:0, paddingTop:0,paddingBottom:0}} transition={{duration:0.4}} className='flex flex-col font-poppins text-black py-1 pb-5 overflow-hidden'>
                <h1 className='2lg:text-[16px] text-[15px]'>Numer produktu: <span className='text-[#6C6C6C]'>{product?.sku}</span></h1>
                <h1 className='2lg:text-[16px] text-[15px]  mt-1'>Wymiary: <br/>
                <span className='text-[#6C6C6C] pl-5'>
                {product?.dimensions?.width_cm} x {product?.dimensions?.height_cm} x {product?.dimensions?.depth_cm} {product?.dimensions?.unit};<br/>
                <span className='font-normal pl-5'>szerokość x wysokość x głębokość;</span> <br/>
                <span className='font-normal pl-5'>jednostka: {product?.dimensions?.unit};</span>
                </span></h1>
                <h1 className='2lg:text-[16px] text-[15px]  mt-2 w-auto'>Waga: <span className='text-[#6C6C6C]'>{product?.weight_g}g</span></h1>
            </motion.div>
        </div>
        <hr className='bg-black h-[1px] mx-1'></hr>
        <div>
            <div className='flex justify-between items-center py-4 w-full text-black 2lg:text-[clamp(16px,1.6vw,18px)] text-[15px] cursor-pointer'>
                <h1 className=''>Producent</h1>
                <span className='text-[#6C6C6C] 2lg:text-[16px] text-[15px]'>{product?.brand}</span>
            </div>
        </div>
    </div>
  )
}

export default ProductDetailsList