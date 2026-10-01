'use client'

import { memo } from 'react'
import { twMerge } from 'tailwind-merge'
import { DiscountBadge, type ProductPriceState } from './price/ProductPrice'

/*
 * Plakietki na kafelku produktu, ułożone jedna pod drugą w lewym górnym rogu:
 * obniżka z rejestru cen, „Bestseller” i „Polecamy” (flagi ustawiane w panelu:
 * Katalog → Wyróżnienia albo hurtowo). Flagi są też sygnałem dla sortowania
 * „Popularne” i dla karuzel na stronie głównej — patrz lib/productSort.ts.
 */
const ProductBadges = memo(function ProductBadges({
  state,
  isFeatured,
  isBestseller,
  className,
  badgeClassName,
}: {
  state: ProductPriceState
  isFeatured?: boolean | null
  isBestseller?: boolean | null
  className?: string
  badgeClassName?: string
}) {
  const badge = twMerge('w-fit p-1 px-2 rounded-[10px] leading-none', badgeClassName)
  return (
    <div className={twMerge('absolute sm:text-[12px] text-[10px] top-4 left-3 z-[0] flex flex-col items-start gap-1.5 pointer-events-none', className)}>
      <DiscountBadge state={state} className={twMerge(badge, 'bg-[#e2f3f0] text-black')} />
      {isBestseller && <span className={twMerge(badge, 'bg-fancy-black text-white')}>Bestseller</span>}
      {isFeatured && <span className={twMerge(badge, 'bg-main text-black')}>Polecamy</span>}
    </div>
  )
})

export default ProductBadges
