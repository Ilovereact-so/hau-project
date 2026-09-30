'use client'

import React from 'react'
import { GetSlugProduct } from '../../sanity.types'
import Image from 'next/image'
import { urlFor } from '@/sanity/lib/image'
import { primaryImageForVariant } from '@/lib/variantImages'
import Link from 'next/link'
import { DiscountBadge, OmnibusNote, PriceRow, useProductPrice } from './price/ProductPrice'
import { WishlistButton } from './WishlistButton'
import { ProductRatingBadge } from './reviews/ProductRatingBadge'

const ProductItemWithoutBTN = ({product}:{product: GetSlugProduct & { defaultVariant?: string }}) => {
  const priceState = useProductPrice(product)
  // Wariant wybrany filtrami listingu (np. kolor) — jego zdjęcie i link.
  const variantKey = product.defaultVariant || product?.variants?.[0]?._key
  const image = primaryImageForVariant(product?.images, variantKey) ?? product?.images?.[0]
  return (
    <div className='relative w-max flex flex-col justify-between h-fit'>
      {product?.images && 
        <Link href={`/product/${product?.slug?.current}?variant=${variantKey}`} className='' >
          <Image src={urlFor(image!).url()} alt={String(product?.title)} width={290} height={290} className='max-sm:w-[calc((100vw-66px)/2))] max-md:w-[calc((100vw-110px)/3))] max-lg:w-[calc((100vw-156px)/3))] max-1.5xl:w-[calc((100vw-156px)/4))] w-[calc((100vw-156px)/5))] 4xl:w-[calc((1900px-156px)/5))] max-sm:h-[calc((100vw-100px)/2))] max-md:h-[calc((100vw-110px)/3))] max-lg:h-[calc((100vw-156px)/3))] max-1.5xl:h-[calc((100vw-156px)/4))] h-[calc((100vw-156px)/5))] 4xl:h-[calc((1900px-156px)/5))] brightness-92'/>
        </Link>
      }
      <WishlistButton productId={product._id} product={product} className='absolute top-4 right-4'/>
      <DiscountBadge
        state={priceState}
        className='bg-[#e2f3f0] p-1 px-2 rounded-[10px] text-black absolute top-4 left-4 2xl:text-[16px] sm:text-[15px] text-[13px]'
      />
      
      <div className='flex flex-col max-sm:w-[calc((100vw-66px)/2))] max-md:w-[calc((100vw-110px)/3))] max-lg:w-[calc((100vw-156px)/3))] max-1.5xl:w-[calc((100vw-156px)/4))]s w-[calc((100vw-156px)/5))] 4xl:w-[calc((1900px-156px)/5))]'>
        <div className='text-black mt-3'>
            <p className='2xl:text-[16px] sm:text-[15px] text-[13px]'>{product.brand}</p>
            <h1 className='2xl:text-[18px] sm::text-[16px] text-[14px] font-medium line-clamp-1 pr-1'>{product.title}</h1>
        </div>
        <ProductRatingBadge
          productId={product._id}
          href={`/product/${product?.slug?.current}?variant=${product?.variants?.[0]?._key}#opinie`}
          className='sm:my-3 my-1'
        />
        <OmnibusNote
          state={priceState}
          className='text-[#6C6C6C] sm:text-[14px] text-[12px] line-clamp-2'
          labelClassName='mt-1'
        />
        <div className='mt-2'>
          <PriceRow
            state={priceState}
            className='2xl:text-[16px] sm:text-[15px] text-[13px]'
            priceClassName='2xl:text-[16px] sm:text-[15px] text-[13px]'
          />
        </div>
          
      </div>
    </div>
  )
}

export default ProductItemWithoutBTN