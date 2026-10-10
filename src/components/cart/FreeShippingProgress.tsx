'use client'

import { Truck } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import PriceFormatter from '@/components/PriceFormatter'
import { missingForFreeShipping, type ShopSettings } from '@/lib/shopSettings'

/**
 * Pasek „Brakuje X zł do darmowej dostawy” — koszyk i mini koszyk.
 * Liczony od wartości produktów (przed kodem rabatowym), tak jak w kasie.
 * Bez ustawionego progu nic się nie wyświetla.
 */
export default function FreeShippingProgress({
  settings,
  subtotal,
  className,
  compact = false,
}: {
  settings: ShopSettings | null
  /** Wartość produktów w zł. */
  subtotal: number
  className?: string
  compact?: boolean
}) {
  if (!settings || settings.freeShippingThresholdCents === null) return null
  const subtotalCents = Math.round(subtotal * 100)
  const missing = missingForFreeShipping(settings, subtotalCents) ?? 0
  const threshold = settings.freeShippingThresholdCents
  const progress = threshold > 0 ? Math.min(1, subtotalCents / threshold) : 1
  const done = missing === 0

  return (
    <div className={twMerge('font-poppins', className)} role="status" aria-live="polite">
      <div className={twMerge('flex items-center gap-2 text-black', compact ? 'text-[13px]' : 'text-[clamp(13px,1.3vw,15px)]')}>
        <Truck className={twMerge('shrink-0 text-[#3F8F84]', compact ? 'w-4 h-4' : 'w-5 h-5')} strokeWidth={1.75} />
        {done ? (
          <span className="font-medium text-[#3F8F84]">Masz darmową dostawę!</span>
        ) : (
          <span>
            Brakuje <PriceFormatter amount={missing / 100} className="font-semibold text-black" /> do darmowej dostawy
          </span>
        )}
      </div>
      <div
        className={twMerge('mt-2 w-full overflow-hidden rounded-full bg-[#DADADA]', compact ? 'h-1.5' : 'h-2')}
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-[#6EB0A6] transition-[width] duration-500 ease-out"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  )
}
