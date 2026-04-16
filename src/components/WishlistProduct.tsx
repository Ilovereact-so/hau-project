'use client'

import { urlFor } from '@/sanity/lib/image'
import Image from 'next/image'
import { memo } from 'react'
import { GetSlugProduct } from 'sanity.types'
import PriceFormatter from './PriceFormatter'
import { WishlistButton } from './WishlistButton'
import { Edit } from 'lucide-react'
import useStore from 'store'

interface Props {
  product: GetSlugProduct
}

const WishlistProduct = memo(function WishlistProduct({ product }: Props) {
  const addItem            = useStore(s => s.addItem)
  const variantsProperties = product.variants?.[0]

  return (
    <div className="flex flex-col w-full relative h-[519px]">
      {product?.images && (
        <Image
          src={urlFor(product.images[0]).url()}
          alt="Product Image"
          className="min-w-[290px] w-[calc((100vw-156px)/3)] h-auto min-h-[290px] brightness-90"
          width={290}
          height={290}
        />
      )}
      <div className="text-black mt-4">
        <p className="text-[16px]">{product.brand}</p>
        <h1 className="text-[18px] font-semibold line-clamp-2">{product.title}</h1>
      </div>
      <div className="flex justify-between mt-2 w-full">
        <div className="text-[#6C6C6C] text-[16px]">
          <p className="mb-2">{product.type?.title}</p>
          {variantsProperties?.optionValues?.map((item, index) => (
            <div key={index} className="flex space-x-1">
              <p>{item.name?.label}</p>
              <p>{item.value?.value}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col justify-between items-end">
          <PriceFormatter
            amount={product?.price as number}
            className="text-black text-[15px] font-normal"
          />
          <Edit className="text-black w-[20px] h-[20px]" />
        </div>
      </div>
      <button
        onClick={() => addItem(product, variantsProperties?._key ?? '')}
        className="w-full border border-black flex justify-center items-center text-black text-[16px] rounded-full py-3 mt-6 font-medium cursor-pointer hover:bg-black hover:text-white transition-colors duration-200"
      >
        Dodaj do koszyka
      </button>
      <label className="p-2 rounded-full ease-in-out duration-200 absolute top-4 left-4 cursor-pointer h-[38px]">
        <WishlistButton
          productId={product._id}
          product={product}
          className="cursor-pointer"
        />
      </label>
    </div>
  )
})

export default WishlistProduct