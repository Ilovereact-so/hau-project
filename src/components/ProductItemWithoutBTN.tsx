'use client'

import React from 'react'
import { GetSlugProduct } from '../../sanity.types'
import Image from 'next/image'
import { urlFor } from '@/sanity/lib/image'
import { primaryImageForVariant } from '@/lib/variantImages'
import Link from 'next/link'
import { OmnibusNote, PriceRow, useProductPrice } from './price/ProductPrice'
import ProductBadges from './ProductBadges'
import { isProductAvailable } from '@/lib/stock'
import { WishlistButton } from './WishlistButton'
import { ProductRatingBadge } from './reviews/ProductRatingBadge'
import { productHref } from '@/lib/productHref'

const ProductItemWithoutBTN = ({product}:{product: GetSlugProduct & { defaultVariant?: string }}) => {
  // Wariant wybrany filtrami listingu (np. kolor) — jego zdjęcie, cena i link.
  const variantKey = product.defaultVariant || product?.variants?.[0]?._key
  const priceState = useProductPrice(product, variantKey ?? null)
  const soldOut = !isProductAvailable(product)
  const image = primaryImageForVariant(product?.images, variantKey) ?? product?.images?.[0]
  return (
    <div className='relative w-max flex flex-col justify-between h-fit'>
      {product?.images && 
        <Link href={productHref(product?.slug?.current, variantKey)} className='relative block' >
          <Image src={urlFor(image!).url()} alt={String(product?.title)} width={290} height={290} className={`${soldOut ? 'opacity-60 ' : ''} max-sm:w-[calc((100vw-66px)/2))] max-md:w-[calc((100vw-110px)/3))] max-lg:w-[calc((100vw-156px)/3))] max-1.5xl:w-[calc((100vw-156px)/4))] w-[calc((100vw-156px)/5))] 4xl:w-[calc((1900px-156px)/5))] max-sm:h-[calc((100vw-100px)/2))] max-md:h-[calc((100vw-110px)/3))] max-lg:h-[calc((100vw-156px)/3))] max-1.5xl:h-[calc((100vw-156px)/4))] h-[calc((100vw-156px)/5))] 4xl:h-[calc((1900px-156px)/5))] brightness-92`}/>
          {soldOut && (
            <span className='absolute left-1/2 -translate-x-1/2 bottom-3 rounded-full bg-white/90 sm:px-3 px-2 py-1 text-[11px] sm:text-[13px] text-black font-medium whitespace-nowrap'>Chwilowo niedostępny</span>
          )}
        </Link>
      }
      <WishlistButton productId={product._id} product={product} className='absolute top-4 right-4'/>
      <ProductBadges
        state={priceState}
        isFeatured={product.isFeatured}
        isBestseller={product.isBestseller}
        isNew={product.isNew}
        className='left-4'
        badgeClassName='2xl:text-[13px] sm:text-[12px] text-[10px] font-poppins'
      />
      
      <div className='flex flex-col max-sm:w-[calc((100vw-66px)/2))] max-md:w-[calc((100vw-110px)/3))] max-lg:w-[calc((100vw-156px)/3))] max-1.5xl:w-[calc((100vw-156px)/4))] w-[calc((100vw-156px)/5))] 4xl:w-[calc((1900px-156px)/5))]'>
        <div className='text-black mt-3'>
            <p className='2xl:text-[16px] sm:text-[15px] text-[13px]'>{product.brand}</p>
            <h3 className='2xl:text-[18px] sm::text-[16px] text-[14px] line-clamp-1 pr-1'>{product.title}</h3>
        </div>
        <ProductRatingBadge
          productId={product._id}
          href={productHref(product?.slug?.current, variantKey, 'opinie')}
          className='sm:my-3 my-1'
        />
        <OmnibusNote
          state={priceState}
          className='text-[#6C6C6C] sm:text-[12px] text-[11px] line-clamp-2'
          labelClassName='mb-1'
        />
        <div className=''>
          <PriceRow
            showPercent={false}
            state={priceState}
            className='2xl:text-[16px] sm:text-[15px] text-[13px]'
            priceClassName='2xl:text-[16px] sm:text-[15px] text-[13px]'
            suffix={<span className="text-[#6C6C6C] text-[12px]"> w tym VAT</span>}
          />
        </div>
          
      </div>
    </div>
  )
}

export default ProductItemWithoutBTN
