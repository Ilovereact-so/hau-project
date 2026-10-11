'use client'

import React, { memo } from 'react'
import { GetSlugProduct } from '../../sanity.types'
import Image from 'next/image'
import { urlFor } from '@/sanity/lib/image'
import Link from 'next/link'
import { OmnibusNote, PriceRow, useProductPrice } from './price/ProductPrice'
import ProductBadges from './ProductBadges'
import { WishlistButton } from './WishlistButton'
import ProductRatingBadge from './reviews/ProductRatingBadge'
import AddToCartButton from './AddToCardButton'


const ProductItem2 = memo(function ProductItem2({ product }: { product: GetSlugProduct }) {
  const variant = product?.variants?.[0]?._key ? product?.variants?.[0]?._key : "";
  const priceState = useProductPrice(product, variant || null)
  return (
    <div className='relative w-max flex flex-col justify-between h-fit rounded-[20px] max-md:bg-[#ededed]'>
      {product?.images && 
        <Link href={`/product/${product?.slug?.current}?variant=${product?.variants?.[0]?._key}`} className='' >
          <div className='max-sm:w-[230px] flex justify-center max-sm:rounded-[20px] max-lg:w-[280px] max-2.5xl:w-[calc((100vw-156px)/3.6))] w-[calc((100vw-156px)/5))] 4xl:w-[calc((1900px-156px)/5))] max-sm:h-[150px] max-lg:h-[calc((100vw-156px)/3.5))] max-2.5xl:h-[230px] h-[250px] 4xl:h-[calc((1900px-156px)/5))]] brightness-93 overflow-hidden'>
            <Image src={urlFor(product?.images[0]).url()} alt={String(product?.title)} width={400} height={400}  className='h-full w-auto scale-[1.4] max-sm:mt-3'/>
          </div>
        </Link>
      } 
      <WishlistButton productId={product._id} product={product} className='absolute top-4 right-4'/>
      
      
      <div className='flex flex-col px-3 pb-4 max-sm:w-[230px] max-lg:w-[280px] max-2.5xl:w-[calc((100vw-156px)/3.6))] w-[calc((100vw-156px)/5))] 4xl:w-[calc((1900px-156px)/5))]'>
        <div className='text-black mt-3'>
            <p className='2xl:text-[16px] sm:text-[15px] text-[13px] text-[#6C6C6C]'>{product.brand}</p>
            <h1 className='2xl:text-[18px] sm:text-[16px] text-[14px]  line-clamp-1 pr-1'>{product.title}</h1>
        </div>
        {/* <p className='mb-1 text-[#6C6C6C] sm:text-[14px] text-[12px] line-clamp-1'>{product.type?.title}</p> */}
        <ProductRatingBadge
          productId={product._id}
          href={`/product/${product?.slug?.current}?variant=${product?.variants?.[0]?._key}#opinie`}
          className='sm:my-3 my-1'
        />
        <OmnibusNote
          state={priceState}
          className='text-[#6C6C6C] sm:text-[12px] text-[11px] line-clamp-2'
          labelClassName=''
        />
        <div className='sm:mt-1 mt-2 flex'>
          <PriceRow
            state={priceState}
            showPercent={false}
            className='2xl:text-[16px] sm:text-[15px] text-[13px]'
            priceClassName='2xl:text-[16px] sm:text-[15px] text-[13px]'
            referenceClassName='2xl:text-[15px] sm:text-[14px] text-[12px]'
            suffix={<span className="text-[#6C6C6C] text-[12px]"> w tym VAT</span>}
          />
          <ProductBadges state={priceState} isFeatured={product.isFeatured} isBestseller={product.isBestseller} />
        </div>
        <AddToCartButton
                product={product}
                variant={variant}
                className=" bg-fancy-black sm:rounded-[24px] rounded-[20px] sm:text-[16px] text-[14px] sm:mt-4 mt-2 max-sm:px-6 max-sm:py-3"
                type="bottom"
        />
        {/* <div className=' flex bg-fancy-black group hover:bg-[#272929] cursor-pointer text-white rounded-[18px] mt-4 text-[16px] ease-in-out duration-200'>
          <div className='w-full flex justify-center py-[10px]'><p>Dodaj do koszyka</p></div>
          <div className='flex px-4 h-full rounded-[20px] py-[10px] border-l border-[#6C6C6C]'>
            <ShoppingBag className='group-hover:text-main text-[#c0c0c0]'/>
          </div>
        </div> */}
      </div>
    </div>
  )
})

export default ProductItem2