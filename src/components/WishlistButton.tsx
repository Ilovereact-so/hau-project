'use client'

import useStore from 'store'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import { memo } from 'react'
import { GetSlugProduct } from 'sanity.types'

type Props = {
  productId:  string
  product?:   GetSlugProduct
  className?: string
  onToggle?:  () => void
}

export const WishlistButton = memo(function WishlistButton({
  productId, product, className, onToggle,
}: Props) {
  const isWishlisted   = useStore(s => s.isWishlisted(productId))
  const toggleWishlist = useStore(s => s.toggleWishlist)

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onToggle?.()
    // zawsze przekaż product jeśli dostępny — potrzebny do real-time na /wishlist
    toggleWishlist(productId, product)
  }

  return (
    <button
      onClick={handleClick}
      aria-label={isWishlisted ? 'Usuń z polubionych' : 'Dodaj do polubionych'}
      className={cn('md:w-[22px] md:h-[22px] w-[20px] h-[20px] transition-transform active:scale-125', className)}
    >
      <Image
        src={isWishlisted ? '/heart.svg' : '/heart_border.svg'}
        width={22}
        height={22}
        alt="Heart icon"
        className="md:w-[22px] md:h-[22px] w-[20px] h-[20px]"
      />
    </button>
  )
})