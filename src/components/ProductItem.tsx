import React from 'react'
import { Product } from '../../sanity.types'
import Image from 'next/image'
import { urlFor } from '@/sanity/lib/image'
import { Heart } from 'lucide-react'

const ProductItem = ({product}:{product: Product}) => {
  return (
    <div className='relative min-w-[290px] min-h-[290px] flex flex-col'>
      {product?.images && 
        <Image src={urlFor(product?.images[0]).url()} alt={String(product?.name)} width={290} height={290} className='w-[290px] h-[290px]'/>
      }
      <Heart className='text-black absolute top-5 right-5'/>
      <h1 className='text-[16px] text-black font-bold mt-3'>{product?.name}</h1>
      <div className='flex justify-between text-black text-[13px] mt-1'>
        <h1>Najniższa cena z ostatnich 30dni:</h1>
        <h1>52,00zł</h1>
      </div>
      <div className='flex justify-between mt-2'>
        <div className='text-white text-[14px] font-bold bg-black rounded-[14px] px-6 py-[10px]'>Dodaj do koszyka</div>
        <div className='flex flex-col'>
          <h1 className='text-[16px] text-[#DD1919] font-bold'>{product?.discount}zł</h1>
          <h1 className='text-black text-[13px]'><span className='mr-1 line-through'>{product?.price}zł</span>-{ (100 - ((parseFloat(String(product?.discount)) / parseFloat(String(product?.price))) * 100)).toFixed(0)}%</h1>
        </div>
      </div>
    </div>
  )
}

export default ProductItem