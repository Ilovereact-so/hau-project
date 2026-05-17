'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Pencil, SquarePen } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import PriceFormatter from '@/components/PriceFormatter'
import { urlFor } from '@/sanity/lib/image'
import useStore from 'store'
import { buildVariantLabel } from './utils'

interface Props {
  shippingCents: number
  deliveryName:  string | null
}

export default function OrderSummary({ shippingCents, deliveryName }: Props) {
  const cartItems     = useStore(s => s.cartItems)
  const getTotalPrice = useStore(s => s.getTotalPrice)
  const subtotalPLN   = getTotalPrice()
  const subtotalCents = Math.round(subtotalPLN * 100)
  const totalCents    = subtotalCents + shippingCents

  return (
    <div className="sticky top-6 overflow-hidden">
      {/* header */}
      <div className="pl-6 pr-2 py-4 flex items-center justify-between">
        <h2 className="text-[20px] font-medium text-black">W twoim koszyku</h2>
        <Link href="/cart" className="text-fancy-black hover:opacity-70 transition-opacity" aria-label="Edytuj koszyk">
          <SquarePen size={22.5} className='text-black' />
        </Link>
      </div>

      {/* subtotal + shipping */}
      <div className="px-6 pb-2 space-y-2 text-[18px] mx-5 w-fit">
        <div className="flex justify-between items-center text-black font-normal space-x-13">
          <span>Wartość produktów</span>
          <PriceFormatter amount={subtotalPLN} className="font-normal text-black text-[16px]" />
        </div>
        <div className="flex justify-between text-black">
          <span>Dostawa</span>
          {deliveryName ? (
            <PriceFormatter amount={shippingCents / 100} className="font-normal text-black text-[16px]" />
          ) : (
            <span>~</span>
          )}
        </div>
      </div>

      {/* item list */}
      <div className="px-6 py-3 space-y-4 mx-5">
        {cartItems.map(({ product, variant, quantity }) => {
          const variantProps  = product.variants?.find((v: any) => v._key === variant)
          const price         = (variantProps?.price ?? product.price ?? 0) * quantity
          const variantLabel  = buildVariantLabel(product, variant)

          return (
            <div key={product._id + variant} className="flex space-x-6 items-start">
              {product.images?.[0] && (
                <div className="w-25 h-25">
                  <Image
                    src={urlFor(product.images[0]).width(112).url()}
                    alt={product.title ?? ''}
                    width={100}
                    height={100}
                    className="w-full h-full object-cover brightness-90"
                  />
                </div>
              )}
              <div className="">
                <PriceFormatter
                  amount={price}
                  className="text-[18px] font-medium text-black block"
                />
                <p className="text-[18px] font-normal text-black line-clamp-1 mt-0.5">
                  {product.title}
                </p>
                {variantLabel && (
                  <p className="text-[18px] text-[#6C6C6C] line-clamp-1">{variantLabel}</p>
                )}
                <p className="text-[18px] text-[#6C6C6C]">Ilość {quantity}</p>
              </div>
              
            </div>
          )
        })}
      </div>

      <Separator />

      {/* total */}
      <div className="px-6 py-5 mx-5 w-fit ">
        <div className="flex justify-between font-bold text-[16px] text-fancy-black space-x-13">
          <span>Do zapłaty <span className="font-normal text-[16px] text-[#6C6C6C]">w tym VAT</span></span>
          <PriceFormatter amount={totalCents / 100} className="text-[17px] font-bold text-fancy-black" />
        </div>
      </div>
    </div>
  )
}
