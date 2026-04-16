import React, { memo } from 'react'
import { GetSlugProduct, Product } from '../../sanity.types'
import Image from 'next/image'
import { urlFor } from '@/sanity/lib/image'
import { Heart } from 'lucide-react'
import Link from 'next/link'
import PriceFormatter from './PriceFormatter'
import { WishlistButton } from './WishlistButton'

const ProductItem2 = memo(function ProductItem2({ product }: { product: GetSlugProduct }) {
  return (
    <div className='relative w-max flex flex-col justify-between h-fit'>
      {product?.images && 
        <Link href={`/product/${product?.slug?.current}?variant=${product?.variants?.[0]?._key}`} className='' >
          <Image src={urlFor(product?.images[0]).url()} alt={String(product?.title)} width={290} height={290} className='max-2.5xl:w-[calc((100vw-156px)/3))] w-[calc((100vw-156px)/4))] 4xl:w-[calc((1900px-156px)/4))] max-2.5xl:h-[calc((100vw-156px)/3))] h-[calc((100vw-156px)/4))] 4xl:h-[calc((1900px-156px)/4))] brightness-90'/>
        </Link>
      }
      <WishlistButton productId={product._id} product={product} className='absolute top-4 left-4'/>
      
      
      <div className='flex flex-col'>
        <div className='text-black mt-4'>
            <p className='text-[16px]'>{product.brand}</p>
            <h1 className='text-[18px] font-semibold line-clamp-2'>{product.title}</h1>
        </div>
        <p className='my-1 text-[#6C6C6C] text-[16px]'>{product.type?.title}</p>
        <p className='mt-1 text-[#6C6C6C] text-[16px] line-clamp-2'>Najniższa cena z ostatnich 30dni:</p>
        <p className='text-[#6C6C6C] text-[16px] line-clamp-2'><PriceFormatter amount={product?.price} className='font-normal'/></p>
        <div className='mt-2'>
          {product?.compareAtPrice ? 
          <div className='text-[16px] space-x-2 flex'>
            <p className='text-black'><PriceFormatter amount={product?.price} className='font-medium'/></p>
            <div className='text-[#6C6C6C] flex'><span className='line-through'><PriceFormatter amount={product?.compareAtPrice} className='font-normal'/></span><span>{(100 - ((parseFloat(String(product?.compareAtPrice)) / parseFloat(String(product?.price))) * 100)).toFixed(0)}%</span></div>
          </div>
          :
          <p className='text-black'><PriceFormatter amount={product?.price} className='font-medium'/></p>
        }
        </div>
          
      </div>
    </div>
  )
})

export default ProductItem2