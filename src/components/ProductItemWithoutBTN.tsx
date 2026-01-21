import React from 'react'
import { GetSlugProduct, Product } from '../../sanity.types'
import Image from 'next/image'
import { urlFor } from '@/sanity/lib/image'
import { Heart } from 'lucide-react'
import Link from 'next/link'
import PriceFormatter from './PriceFormatter'

const ProductItemWithoutBTN = ({product}:{product: GetSlugProduct & { defaultVariant?: string }}) => {
  return (
    <Link href={`/product/${product?.slug?.current}?variant=${product.defaultVariant ? product.defaultVariant : product?.variants?.[0]?._key}`} className='relative 1xl:min-w-[290px] lg:min-w-[230px] 3xs:min-w-[200px] min-w-[100px] 1xl:min-h-[290px] lg:min-h-[230px] 3xs:min-h-[200px] min-h-[100px] flex flex-col 3xs:w-fit w-min'>
      {product?.images && 
        <Image src={urlFor(product?.images[0]).url()} alt={String(product?.title)} width={290} height={290} className='1xl:w-[290px] lg:w-[230px] 3xs:w-[200px] w-auto max-3xs:min-w-[clamp(100px,35vw,190px)] 1xl:h-[290px] lg:h-[230px] 3xs:h-[200px] h-[clamp(100px,35vw,190px)] brightness-90'/>
      }
      <Heart className='text-black absolute 3xs:top-5 top-3 3xs:right-5 right-3 3xs:w-[24px] w-[18px] 3xs:h-[24px] h-[18px]'/>
      <h1 className='1xl:text-[16px] text-[15px] text-black font-bold mt-3'>{product?.title}</h1>
      <div className='flex justify-start mt-1'>
        <h1 className={`1xl:text-[16px] lg:text-[14px] text-[13px]  font-bold ${
        product?.compareAtPrice ? "text-[#DD1919]" : "text-black"
        }`}><PriceFormatter amount={product?.price}/></h1>
      </div>

      <div className='flex justify-between text-black 1xl:text-[13px] text-[11px]'>
        <h1>Najniższa cena z ostatnich 30dni:</h1>
        <h1>52,00zł</h1>
      </div>
      <div className='flex justify-start'>
        {product?.compareAtPrice && 
          <h1 className='text-black 1xl:text-[13px] lg:text-[11px] text-[10px]'><span className='mr-1 line-through'>{product?.compareAtPrice}zł</span>{ (100 - ((parseFloat(String(product?.compareAtPrice)) / parseFloat(String(product?.price))) * 100)).toFixed(0)}%</h1>
        }
      </div>
    </Link>
  )
}

export default ProductItemWithoutBTN