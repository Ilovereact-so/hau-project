'use client'

import type { ProductOmnibus } from '@/lib/omnibus'
import { OmnibusNote, PriceRow, useProductPrice, type PricedProduct } from './ProductPrice'

/**
 * Cena na stronie produktu — dla WYBRANEGO wariantu (tyle zapłaci klient
 * po dodaniu do koszyka). Dane Omnibus przychodzą policzone z serwera.
 */
export default function ProductPagePrice({
  product,
  variantKey,
  initial,
}: {
  product: PricedProduct
  variantKey: string
  initial: ProductOmnibus | null
}) {
  const state = useProductPrice(product, variantKey, initial)
  return (
    <div>
      <PriceRow
        state={state}
        className="2xl:text-[22px] sm:text-[15px] text-[13px]"
        priceClassName="sm:text-[22px] text-[13px] text-black"
        referenceClassName="2xl:text-[18px] sm:text-[14px] text-[13px]"
        suffix={<span className="text-[#6C6C6C] sm:text-[14px] text-[12px]">w tym VAT</span>}
      />
      <OmnibusNote
        state={state}
        className="text-[#6C6C6C] sm:text-[12px] text-[11px] line-clamp-2 mt-0.5"
        labelClassName=""
      />
    </div>
  )
}
