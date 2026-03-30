import React from 'react'
import { GetSlugProduct, Product } from '../../sanity.types'
import Image from 'next/image'
import { urlFor } from '@/sanity/lib/image'
import { Heart } from 'lucide-react'
import Link from 'next/link'
import PriceFormatter from './PriceFormatter'
import { useWishListStore } from 'store'

const ProductItem2 = ({product}:{product: GetSlugProduct}) => {
  const {addItem} = useWishListStore()
  return (
    <div className='relative w-max flex flex-col justify-between'>
      {product?.images && 
        <Link href={`/product/${product?.slug?.current}?variant=${product?.variants?.[0]?._key}`} >
          <Image src={urlFor(product?.images[0]).url()} alt={String(product?.title)} width={290} height={290} className='w-[clamp(290px,100%,500px)] brightness-90'/>
        </Link>
      }
      <div onClick={()=>product.variants?.[0]._key && addItem(product, product?.variants?.[0]._key)} className='cursor-pointer'>
        <Heart className='text-black absolute top-5 right-5'/>
      </div>
      <div className='flex flex-col'>
      <h1 className='1xl:text-[16px] text-[15px] text-black font-bold mt-2 line-clamp-2 '>{product?.title}</h1>
      <div className='flex justify-between text-black 1xl:text-[13px] text-[11px] mt-1'>
        <h1>Najniższa cena z ostatnich 30dni:</h1>
        <h1>52,00zł</h1>
      </div>
      </div>
      <div className='flex justify-between mt-2'>
        <div className='text-white 1xl:text-[14px] lg:text-[12px] text-[11px] font-bold bg-black rounded-[14px] 1xl:px-6 px-4 1xl:py-[10px] py-2 flex items-center'>Dodaj do koszyka</div>
        <div className='flex flex-col justify-center'>
          {product?.compareAtPrice ? 
        (<div className='flex flex-col items-end'>
          <h1 className='1xl:text-[16px] lg:text-[14px] text-[13px] text-[#DD1919] font-bold'><PriceFormatter amount={product?.price}/></h1>
          <h1 className='text-black 1xl:text-[13px] lg:text-[11px] text-[10px]'><span className='mr-1 line-through'>{product?.compareAtPrice}zł</span>{ (100 - ((parseFloat(String(product?.compareAtPrice)) / parseFloat(String(product?.price))) * 100)).toFixed(0)}%</h1>
        </div>
        )
        :
        (
          <h1 className='1xl:text-[18px] lg:text-[14px] text-[13px] text-black font-bold'><PriceFormatter amount={product?.price}/></h1>
        ) 
        }
          </div>
      </div>
    </div>
  )
}

export default ProductItem2