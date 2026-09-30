'use client'

import Image from 'next/image'
import Link from 'next/link'
import { SquarePen } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import PriceFormatter from '@/components/PriceFormatter'
import { urlFor } from '@/sanity/lib/image'
import { primaryImageForVariant } from '@/lib/variantImages'
import useStore from 'store'
import { buildVariantLabel } from './utils'
import { applyDiscount } from '@/lib/discounts'
import type { DiscountPreview } from '@/actions/discounts'

interface Props {
  shippingCents?:   number
  deliveryName?:    string | null
  /** podgląd kodu z koszyka (liczy serwer); kwotę w zamówieniu i tak ustala kasa */
  discount?:        Extract<DiscountPreview, { ok: true }> | null
  discountLoading?: boolean
}

export default function OrderSummary({ shippingCents, deliveryName, discount, discountLoading }: Props) {
  const cartItems     = useStore(s => s.cartItems)
  const getTotalPrice = useStore(s => s.getTotalPrice)
  const subtotalPLN   = getTotalPrice()
  const subtotalCents = Math.round(subtotalPLN * 100)
  const hasShipping   = Boolean(deliveryName && shippingCents)
  const applied       = discount?.applicable ? discount : null
  const { discountCents, totalCents } = applyDiscount(
    applied ? { ok: true, productDiscountCents: applied.productDiscountCents, freeShipping: applied.freeShipping } : null,
    subtotalCents,
    hasShipping ? shippingCents! : 0,
  )

  return (
    <div className="sticky top-6 overflow-hidden md:mt-10 sm:mt-8 mt-5 lg:min-w-[360px] min-w-[320px]">
      {/* header */}
      <div className="md:pl-6 pl-2 pr-2 py-4 flex items-center justify-between">
        <h2 className="text-[clamp(16px,1.4vw,20px)] font-medium text-black">W twoim koszyku</h2>
        <Link href="/cart" className="text-fancy-black hover:opacity-70 transition-opacity" aria-label="Edytuj koszyk">
          <SquarePen size={22} className='text-black lg:w-6 lg:h-6 w-5 h-5' />
        </Link>
      </div>

      {/* subtotal + shipping */}
      <div className="md:pl-6 pl-2 pr-2 pb-2 space-y-1 text-[clamp(13px,1.4vw,16px)] w-full">
        <div className="flex justify-between items-center text-black font-normal 2xl:space-x-13">
          <span>Wartość produktów</span>
          <PriceFormatter amount={subtotalPLN} className="font-normal text-black text-[clamp(14px,1.2vw,16px)]" />
        </div>
        <div className="flex justify-between text-black">
          <span>Dostawa</span>
          {hasShipping ? (
            applied?.freeShipping ? (
              <span className="flex items-center gap-2">
                <PriceFormatter amount={shippingCents! / 100} className="font-normal line-through text-[#8E8E8E] text-[clamp(14px,1.2vw,16px)]" />
                <span className="text-[#3F8F84] font-medium">Gratis</span>
              </span>
            ) : (
              <PriceFormatter amount={shippingCents! / 100} className="font-normal text-black text-[clamp(14px,1.2vw,16px)]" />
            )
          ) : (
            <span>~</span>
          )}
        </div>
        {applied && discountCents > 0 && !applied.freeShipping && (
          <div className="flex justify-between text-[#3F8F84]">
            <span>Rabat <span className="font-medium">({applied.code})</span></span>
            <PriceFormatter amount={-discountCents / 100} className="font-normal text-[clamp(14px,1.2vw,16px)]" />
          </div>
        )}
        {discount && !discount.applicable && discount.message && (
          <p className="text-[13px] text-[#6C6C6C]">Kod {discount.code}: {discount.message}</p>
        )}
        {discountLoading && <p className="text-[13px] text-[#8E8E8E]">Przeliczam rabat…</p>}
      </div>

      {/* item list */}
      <div className="md:pl-6 pl-2 py-3 space-y-4 ">
        {cartItems.map(({ product, variant, quantity }) => {
          const variantProps  = product.variants?.find((v: any) => v._key === variant)
          const price         = (variantProps?.price ?? product.price ?? 0) * quantity
          const variantLabel  = buildVariantLabel(product, variant)

          return (
            <div key={product._id + variant} className="flex space-x-5 items-start">
              {product.images?.[0] && (
                <div className="min-w-25 min-h-25 h-[100px]">
                  <Image
                    src={urlFor(primaryImageForVariant(product.images, variant) ?? product.images[0]).width(112).url()}
                    alt={product.title ?? ''}
                    width={100}
                    height={100}
                    className="w-[100px] h-[100px] object-cover brightness-93 rounded-[20px]"
                  />
                </div>
              )}
              <div className="">
                <PriceFormatter
                  amount={price}
                  className="text-[clamp(14px,1.3vw,16px)] font-normal text-black block"
                />
                <p className="text-[clamp(15px,1.3vw,18px)] font-normal text-black line-clamp-1 mt-0.5">
                  {product.title}
                </p>
                {variantLabel && (
                  <p className="text-[clamp(14px,1.3vw,15px)] text-[#6C6C6C] line-clamp-1">{variantLabel}</p>
                )}
                <p className="text-[clamp(14px,1.3vw,15px)] text-[#6C6C6C]">Ilość {quantity}</p>
              </div>
              
            </div>
          )
        })}
      </div>

      <Separator />

      {/* total */}
      <div className="px-6 py-5 w-full ">
        <div className="flex justify-between font-medium text-[clamp(15px,1.3vw,17px)] text-fancy-black 2xl:space-x-13">
          <span>Do zapłaty <span className="font-normal text-[clamp(15px,1.3vw,17px)] text-[#6C6C6C]">w tym VAT</span></span>
          <PriceFormatter amount={totalCents / 100} className="text-[16px] font-medium text-fancy-black" />
        </div>
      </div>
    </div>
  )
}
