import React from 'react'
import { Product } from '../../sanity.types'
import Image from 'next/image'
import { urlFor } from '@/sanity/lib/image'
import { Heart } from 'lucide-react'
import Link from 'next/link'

const ProductItem = ({product}:{product: Product}) => {
  return (
    <Link href={`/product/${product?.slug?.current}`} className='relative 1xl:min-w-[290px] lg:min-w-[230px] min-w-[200px] 1xl:min-h-[290px] lg:min-h-[230px] min-h-[200px] flex flex-col'>
      {product?.images && 
        <Image src={urlFor(product?.images[0]).url()} alt={String(product?.name)} width={290} height={290} className='1xl:w-[290px] lg:w-[230px] w-[200px] 1xl:h-[290px] lg:h-[230px] h-[200px]'/>
      }
      <Heart className='text-black absolute top-5 right-5'/>
      <h1 className='1xl:text-[16px] lg:text-[14px] text-[13px] text-black font-bold mt-3'>{product?.name}</h1>
      <div className='flex justify-between text-black 1xl:text-[13px] lg:text-[11px] text-[9px] mt-1'>
        <h1>Najniższa cena z ostatnich 30dni:</h1>
        <h1>52,00zł</h1>
      </div>
      <div className='flex justify-between mt-2'>
        <div className='text-white 1xl:text-[14px] lg:text-[12px] text-[11px] font-bold bg-black rounded-[14px] 1xl:px-6 px-4 1xl:py-[10px] py-2 flex items-center'>Dodaj do koszyka</div>
        <div className='flex flex-col'>
          <h1 className='1xl:text-[16px] lg:text-[14px] text-[13px] text-[#DD1919] font-bold'>{product?.discount}zł</h1>
          <h1 className='text-black 1xl:text-[13px] lg:text-[11px] text-[10px]'><span className='mr-1 line-through'>{product?.price}zł</span>-{ (100 - ((parseFloat(String(product?.discount)) / parseFloat(String(product?.price))) * 100)).toFixed(0)}%</h1>
        </div>
      </div>
    </Link>
  )
}

export default ProductItem