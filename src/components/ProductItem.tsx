'use client'

import React from 'react'
import { GetSlugProduct } from '../../sanity.types'
import Image from 'next/image'
import { urlFor } from '@/sanity/lib/image'
import { Heart } from 'lucide-react'
import Link from 'next/link'
import { OmnibusNote, PriceRow, useProductPrice } from './price/ProductPrice'


const ProductItem = ({product}:{product: GetSlugProduct}) => {
  const priceState = useProductPrice(product)

  return (
    <div className='relative 1xl:min-w-[290px] lg:min-w-[230px] min-w-[200px] 1xl:min-h-[290px] lg:min-h-[230px] min-h-[200px] flex flex-col justify-between w-fit'>
      {product?.images && 
        <Link href={`/product/${product?.slug?.current}?variant=${product?.variants?.[0]?._key}`} >
          <Image src={urlFor(product?.images[0]).url()} alt={String(product?.title)} width={290} height={290} className='1xl:w-[290px] lg:w-[230px] w-[200px] 1xl:h-[290px] lg:h-[230px] h-[200px] brightness-90'/>
        </Link>
      }
      {/* onClick={()=>product.variants?.[0]._key && addItem(product, product?.variants?.[0]._key)} */}
      <div  className='cursor-pointer'>
        <Heart className='text-black absolute top-5 right-5'/>
      </div>
      <div className='flex flex-col'>
      <h3 className='1xl:text-[16px] text-[15px] text-black font-bold mt-2 line-clamp-2 '>{product?.title}</h3>
      <div className='text-black 1xl:text-[13px] text-[11px] mt-1'>
        <OmnibusNote state={priceState} className='text-[#6C6C6C] text-[11px]' />
      </div>
      </div>
      <div className='flex justify-between mt-2'>
        <div className='text-white 1xl:text-[14px] lg:text-[12px] text-[11px] font-bold bg-black rounded-[14px] 1xl:px-6 px-4 1xl:py-[10px] py-2 flex items-center'>Dodaj do koszyka</div>
        <div className='flex flex-col justify-center'>
          <PriceRow
            state={priceState}
            className='flex-col items-end gap-0 1xl:text-[16px] lg:text-[14px] text-[13px]'
            priceClassName='font-bold 1xl:text-[16px] lg:text-[14px] text-[13px]'
            referenceClassName='text-black 1xl:text-[13px] lg:text-[11px] text-[10px]'
          />
          </div>
      </div>
    </div>
  )
}

export default ProductItem