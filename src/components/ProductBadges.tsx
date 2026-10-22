'use client'

import { memo } from 'react'
import { twMerge } from 'tailwind-merge'
import { DiscountBadge, type ProductPriceState } from './price/ProductPrice'

/*
 * Plakietki na kafelku produktu, ułożone jedna pod drugą w lewym górnym rogu:
 * obniżka z rejestru cen, „Nowość”, „Bestseller” i „Polecamy” (flagi ustawiane
 * w panelu: Katalog → Wyróżnienia albo hurtowo). Flagi są też sygnałem dla sortowania
 * „Popularne” i dla karuzel na stronie głównej — patrz lib/productSort.ts.
 */
const ProductBadges = memo(function ProductBadges({
  state,
  isFeatured,
  isBestseller,
  isNew,
  className,
  badgeClassName,
}: {
  state: ProductPriceState
  isFeatured?: boolean | null
  isBestseller?: boolean | null
  isNew?: boolean | null
  className?: string
  badgeClassName?: string
}) {
  const badge = twMerge('w-fit p-1.5 px-2.5 rounded-[15px] leading-none', badgeClassName)
  return (
    <div className={twMerge('absolute sm:text-[12px] text-[10px] top-4 left-3 z-[0] flex flex-col items-start gap-1.5 font-poppins pointer-events-none', className)}>
      <DiscountBadge state={state} className={twMerge(badge, 'bg-[#e2f3f0] text-black')} />
      {isNew && <span className={twMerge(badge, 'bg-[#f6e3a8] text-black')}>Nowość</span>}
      {isBestseller && <span className={twMerge(badge, 'bg-fancy-black text-[#eceaea] ')}>Bestseller</span>}
      {isFeatured && <span className={twMerge(badge, 'bg-main text-black')}>Polecamy</span>}
    </div>
  )
})

export default ProductBadges
