'use client'

import { urlFor } from '@/sanity/lib/image'
import Image from 'next/image'
import { memo } from 'react'
import { GetSlugProduct } from 'sanity.types'
import { OmnibusNote, PriceRow, useProductPrice } from './price/ProductPrice'
import ProductBadges from './ProductBadges'
import { WishlistButton } from './WishlistButton'
import AddToCartButton from './AddToCardButton'
import { Edit } from 'lucide-react'
import ProductRatingBadge from './reviews/ProductRatingBadge'
import Link from 'next/link'
import { productHref } from '@/lib/productHref'
interface Props {
  product: GetSlugProduct
}

const WishlistProduct = memo(function WishlistProduct({ product }: Props) {
  const variantsProperties = product.variants?.[0]
  const priceState = useProductPrice(product, variantsProperties?._key ?? null)

  return (
    <div className="flex flex-col justify-between h-full calc relative  max-sm:w-[calc((100vw-60px)/2))] max-md:w-[calc((100vw-90px)/2))] max-lg:w-[calc((100vw-330px)/2))]  max-xl:w-[calc((100vw-330px)/3))] max-3xl:w-[calc((100vw-440px)/3))] w-[calc((100vw-156px)/5))] 4xl:w-[calc((1900px-156px)/5))] ">
      <div className='flex flex-col h-auto'>
        {product?.images && 
        <Link href={productHref(product?.slug?.current, product?.variants?.[0]?._key)} className='' >
          <div className='max-sm:w-[calc((100vw-70px)/2))]  flex justify-center  max-md:w-[calc((100vw-90px)/2))] max-lg:w-[calc((100vw-330px)/2))] max-xl:w-[calc((100vw-330px)/3))] calc max-3xl:w-[calc((100vw-440px)/3))] w-[calc((100vw-156px)/5))] 4xl:w-[calc((1900px-156px)/5))] max-sm:h-[150px] max-md:h-[190px] max-lg:h-[calc((100vw-156px)/3.5))] max-2.5xl:h-[230px] h-[250px] 4xl:h-[calc((1900px-156px)/5))]] brightness-93 overflow-hidden'>
            <Image src={urlFor(product?.images[0]).url()} alt={String(product?.title)} width={400} height={400}  className='h-full w-auto 2xl:scale-[1.4] 2lg:scale-[1.2] 3md:scale-[1.5] 1md:scale-[1.4] 3xs:scale-[1.6] 2xs:scale-[1.3] scale-[1.1] max-sm:mt-3'/>
          </div>
        </Link>
      } 
        <div className="text-black mt-4">
          <p className="2xl:text-[16px] sm:text-[15px] text-[13px]">{product.brand}</p>
          <h3 className="2xl:text-[18px] sm:text-[16px] text-[14px] line-clamp-2">{product.title}</h3>
        </div>
      </div>
      <ProductRatingBadge
        productId={product._id}
        href={productHref(product?.slug?.current, product?.variants?.[0]?._key, 'opinie')}
        className='sm:my-3 my-1 flex-wrap gap-y-1'
        textClassName='text-[#6C6C6C] sm:text-[14px] text-[12px]'
      />

      <ProductBadges
        state={priceState}
        isFeatured={product.isFeatured}
        isBestseller={product.isBestseller}
        isNew={product.isNew}
        className='left-4'
        badgeClassName='2xl:text-[14px] sm:text-[13px] text-[11px]'
      />
      <div className='flex flex-col h-full justify-end'>
        <div className="flex justify-between w-full mt-1">
          <div className="text-[#6C6C6C] sm:text-[14px] text-[12px]">
            <p className="mb-2">{product.type?.title}</p>
            {variantsProperties?.optionValues?.map((item, index) => (
              <div key={index} className="flex space-x-1">
                <p>{item.name?.label}</p>
                <p>{item.value?.value}</p>
              </div>
            ))}
          </div>
          <div className="flex 3xs:flex-col flex-col-reverse justify-between items-end mt-1">
            <PriceRow
              state={priceState}
              showPercent={false}
              className="justify-end sm:text-[15px] text-[14px]"
              priceClassName="text-black sm:text-[15px] text-[14px] font-normal"
              referenceClassName="sm:text-[13px] text-[12px]"
            />
            <Edit className="text-black w-[20px] h-[20px]" />
          </div>
        </div>
        <div className="mt-1">
          <OmnibusNote state={priceState} className="text-[#6C6C6C] sm:text-[12px] text-[11px] leading-tight" />
        </div>
        {/* <button
          onClick={() => addItem(product, variantsProperties?._key ?? '')}
          className="w-full border border-black flex justify-center items-center text-black text-[16px] rounded-full py-3 mt-6 font-medium cursor-pointer hover:bg-fancy-black hover:text-white transition-colors duration-200"
        >
          Dodaj do koszyka
        </button> */}
        <AddToCartButton
                product={product}
                variant={variantsProperties?._key ? variantsProperties?._key : ""}
                className="border border-fancy-black bg-transparent text-black hover:text-white sm:rounded-[24px] rounded-[20px] 2xl:text-[16px] sm:text-[15px] text-[13px] sm:mt-4 mt-3 max-sm:px-5 max-sm:py-3"
                type="bottom"
        />
        <WishlistButton productId={product._id} product={product} className='absolute top-4 right-4 ease-in-out duration-200'/>
      </div>
    </div>
  )
})

export default WishlistProduct
