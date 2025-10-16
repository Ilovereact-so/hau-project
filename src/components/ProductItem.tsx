import React from 'react'
import { Product } from '../../sanity.types'
import Image from 'next/image'
import { urlFor } from '@/sanity/lib/image'
import { Heart } from 'lucide-react'

const ProductItem = ({product}:{product: Product}) => {
  return (
    <div className='relative xl:min-w-[290px] min-w-[230px] xl:min-h-[290px] min-h-[230px] flex flex-col'>
      {product?.images && 
        <Image src={urlFor(product?.images[0]).url()} alt={String(product?.name)} width={290} height={290} className='xl:w-[290px] w-[230px] xl:h-[290px] h-[230px]'/>
      }
      <Heart className='text-black absolute top-5 right-5'/>
      <h1 className='xl:text-[16px] text-[14px] text-black font-bold mt-3'>{product?.name}</h1>
      <div className='flex justify-between text-black xl:text-[13px] text-[11px] mt-1'>
        <h1>Najniższa cena z ostatnich 30dni:</h1>
        <h1>52,00zł</h1>
      </div>
      <div className='flex justify-between mt-2'>
        <div className='text-white xl:text-[14px] text-[12px] font-bold bg-black rounded-[14px] xl:px-6 px-4 xl:py-[10px] py-2 flex items-center'>Dodaj do koszyka</div>
        <div className='flex flex-col'>
          <h1 className='xl:text-[16px] text-[14px] text-[#DD1919] font-bold'>{product?.discount}zł</h1>
          <h1 className='text-black xl:text-[13px] text-[11px]'><span className='mr-1 line-through'>{product?.price}zł</span>-{ (100 - ((parseFloat(String(product?.discount)) / parseFloat(String(product?.price))) * 100)).toFixed(0)}%</h1>
        </div>
      </div>
    </div>
  )
}

export default ProductItem