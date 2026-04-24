'use client'

import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
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
    <div className="sticky top-6 bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden">
      <div className="px-6 py-5 border-b border-[#F0F0F0]">
        <h2 className="text-[17px] font-semibold text-fancy-black">Twoje zamówienie</h2>
      </div>

      <div className="px-6 py-4 space-y-4 max-h-80 overflow-y-auto">
        <AnimatePresence initial={false}>
          {cartItems.map(({ product, variant, quantity }) => {
            const variantProps = product.variants?.find((v: any) => v._key === variant)
            const price = (variantProps?.price ?? product.price ?? 0) * quantity
            return (
              <motion.div
                key={product._id + variant}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex gap-3 items-start"
              >
                {product.images?.[0] && (
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-[#F0F0F0]">
                    <Image
                      src={urlFor(product.images[0]).width(96).url()}
                      alt={product.title ?? ''}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-fancy-black line-clamp-1">
                    {product.title}
                  </p>
                  <p className="text-[12px] text-[#6C6C6C] line-clamp-1">
                    {buildVariantLabel(product, variant) || `Ilość: ${quantity}`}
                  </p>
                  {quantity > 1 && (
                    <p className="text-[12px] text-[#6C6C6C]">× {quantity}</p>
                  )}
                </div>
                <PriceFormatter
                  amount={price}
                  className="text-[13px] font-semibold text-fancy-black flex-shrink-0"
                />
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      <Separator />

      <div className="px-6 py-5 space-y-3 text-[14px]">
        <div className="flex justify-between text-[#6C6C6C]">
          <span>Produkty</span>
          <PriceFormatter amount={subtotalPLN} className="font-normal text-[#6C6C6C]" />
        </div>
        <div className="flex justify-between text-[#6C6C6C]">
          <span>Dostawa</span>
          {deliveryName ? (
            <PriceFormatter amount={shippingCents / 100} className="font-normal text-[#6C6C6C]" />
          ) : (
            <span>—</span>
          )}
        </div>

        <Separator />

        <div className="flex justify-between font-bold text-[16px] text-fancy-black">
          <span>Do zapłaty</span>
          <PriceFormatter amount={totalCents / 100} className="text-[17px] font-bold text-fancy-black" />
        </div>
      </div>
    </div>
  )
}
