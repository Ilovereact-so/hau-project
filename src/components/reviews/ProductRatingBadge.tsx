'use client'

import Link from 'next/link'
import { memo } from 'react'
import { cn } from '@/lib/utils'
import { useReviewSummary } from '@/hooks/useReviewSummary'
import { formatAverage, reviewsLabel, type ReviewSummary } from '@/lib/reviewsShared'
import { PawRating } from './PawRating'

type Props = {
  productId: string
  /** Link do sekcji opinii (np. `/product/slug?variant=…#opinie`). */
  href?: string
  /** Podsumowanie policzone na serwerze — bez niego kafelek pyta API. */
  initial?: ReviewSummary | null
  className?: string
  pawClassName?: string
  textClassName?: string
  /** `card` — „4,8 (20)” jak na kafelkach; `full` — „4,8 · 20 opinii”. */
  variant?: 'card' | 'full'
}

/**
 * Realna ocena produktu w łapkach (zastępuje dawne, wpisane na sztywno
 * „4.8 (20)”). Dane z `useReviewSummary` — wiele kafelków na stronie
 * składa się w jedno żądanie. Podczas ładowania trzyma tę samą wysokość,
 * żeby kafelek nie skakał.
 */
export const ProductRatingBadge = memo(function ProductRatingBadge({
  productId,
  href,
  initial,
  className,
  pawClassName = 'w-6 h-6',
  textClassName = 'text-[#6C6C6C] sm:text-[14px] text-[12px]',
  variant = 'card',
}: Props) {
  const summary = useReviewSummary(productId, initial)
  const loading = summary === undefined
  const count = summary?.count ?? 0
  const average = summary?.average ?? 0

  let text: string
  if (loading) text = ''
  else if (!summary) text = ''
  else if (!count) text = variant === 'full' ? 'Brak opinii — oceń jako pierwszy' : ''
  else if (variant === 'full') text = `${formatAverage(average)} · ${count} ${reviewsLabel(count)}`
  else text = `${formatAverage(average)} (${count})`

  const label = loading
    ? 'Wczytywanie oceny'
    : count
      ? `Ocena ${formatAverage(average)} na 5 na podstawie ${count} ${reviewsLabel(count)}`
      : 'Produkt nie ma jeszcze opinii'

  const content = (
    <>
      <PawRating
        value={average}
        pawClassName={pawClassName}
        colorClassName={loading || !count ? 'text-[#C9DED9]' : 'text-[#6EB0A6]'}
        className={cn(loading && 'animate-pulse')}
        label={label}
      />
      <span className={cn('ml-2 whitespace-nowrap', textClassName)} aria-hidden={loading || undefined}>
        {text}
      </span>
    </>
  )

  const classes = cn('flex items-center min-h-6', className)

  if (href) {
    return (
      <Link href={href} className={cn(classes, 'w-fit hover:opacity-80 transition-opacity')} scroll={true}>
        {content}
      </Link>
    )
  }
  return <div className={classes}>{content}</div>
})

export default ProductRatingBadge
