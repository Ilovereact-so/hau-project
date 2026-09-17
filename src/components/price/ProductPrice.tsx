'use client'

import { memo } from 'react'
import { twMerge } from 'tailwind-merge'
import PriceFormatter from '@/components/PriceFormatter'
import { useOmnibus } from '@/hooks/useOmnibus'
import {
  effectivePrice,
  resolveOmnibus,
  tilePriceKey,
  type OmnibusInfo,
  type ProductOmnibus,
} from '@/lib/omnibus'

/*
 * Cena produktu + informacja o najniższej cenie z 30 dni (Omnibus).
 *
 * Cena wyświetlana = cena, którą zapłaci klient (wariant → produkt), tak jak
 * w koszyku i checkoucie. Obniżka i cena przekreślona pochodzą WYŁĄCZNIE
 * z rejestru cen (lib/omnibus.ts) — ręczne „compareAtPrice” nie jest już
 * używane w sklepie, bo procent obniżki musi się odnosić do najniższej
 * ceny z 30 dni przed obniżką.
 */

export type PricedProduct = {
  _id: string
  price?: number | null
  variants?: Array<{ _key?: string | null; price?: number | null } | null> | null
}

export type ProductPriceState = {
  price: number | null
  /** `null` — ładowanie albo brak ceny. */
  info: OmnibusInfo | null
  loading: boolean
}

/** Cena + dane Omnibus dla wariantu (domyślnie wariant z kafelka). */
export function useProductPrice(
  product: PricedProduct,
  variantKey?: string | null,
  initial?: ProductOmnibus | null,
  options: {
    /**
     * Cena z produktu może być nieaktualna (np. zapisana w localStorage
     * „ostatnio oglądane”) — gdy rejestr zna bieżącą cenę, pokaż ją.
     */
    preferRegistryPrice?: boolean
  } = {},
): ProductPriceState {
  const key = variantKey ?? tilePriceKey(product)
  const catalogPrice = effectivePrice(product, key)
  const data = useOmnibus(catalogPrice === null && !options.preferRegistryPrice ? null : product._id, initial)
  const registry = options.preferRegistryPrice ? data?.[key] : undefined
  const price = registry ? registry.price : catalogPrice
  if (price === null) return { price: null, info: null, loading: false }
  const info = resolveOmnibus(data, key, price)
  return { price, info, loading: info === null }
}

export function omnibusLabel(info: OmnibusInfo | null) {
  return info?.promo ? 'Najniższa cena z 30 dni przed obniżką:' : 'Najniższa cena z 30 dni:'
}

/** Dwie linijki „Najniższa cena z 30 dni: …” (etykieta + kwota). */
export const OmnibusNote = memo(function OmnibusNote({
  state,
  className,
  labelClassName,
  amountClassName,
}: {
  state: ProductPriceState
  className?: string
  /** Dodatkowe klasy tylko dla linijki z etykietą (np. margines). */
  labelClassName?: string
  amountClassName?: string
}) {
  if (state.price === null) return null
  const { info, loading } = state
  const amount = info?.promo ? info.promo.referencePrice : info?.lowest30d
  return (
    <div className={twMerge('flex space-x-1 items-center flex-wrap')}>
      <p className={twMerge(className, labelClassName)}>{omnibusLabel(info)}</p>
      <p className={className} aria-busy={loading || undefined}>
        {loading || amount === undefined ? (
          <span className="inline-block h-[1em] w-16 animate-pulse rounded bg-[#e3e3e3] align-middle" aria-label="Wczytywanie" />
        ) : (
          <PriceFormatter amount={amount} className={twMerge('font-normal', amountClassName)} />
        )}
      </p>
    </div>
  )
})

/** Plakietka „-20%” — tylko przy obniżce z rejestru. */
export const DiscountBadge = memo(function DiscountBadge({
  state,
  className,
}: {
  state: ProductPriceState
  className?: string
}) {
  const promo = state.info?.promo
  if (!promo) return null
  return (
    <div className={className} aria-label={`Obniżka ${promo.percent}%`}>
      <span>-{promo.percent}%</span>
    </div>
  )
})

/**
 * Cena sprzedaży; przy obniżce dodatkowo przekreślona cena odniesienia
 * (najniższa z 30 dni przed obniżką) i opcjonalnie procent.
 */
export const PriceRow = memo(function PriceRow({
  state,
  className,
  priceClassName,
  referenceClassName,
  showPercent = true,
  suffix,
}: {
  state: ProductPriceState
  className?: string
  priceClassName?: string
  referenceClassName?: string
  showPercent?: boolean
  /** Np. „w tym VAT” za ceną. */
  suffix?: React.ReactNode
}) {
  if (state.price === null) return <p className={twMerge('text-[#6C6C6C]', className)}>Cena niedostępna</p>
  const promo = state.info?.promo
  return (
    <div className={twMerge('flex items-center gap-x-2 flex-wrap', className)}>
      <p className="text-black">
        <PriceFormatter amount={state.price} className={twMerge('font-medium', priceClassName)} />
      </p>
      {promo && (
        <div className={twMerge('text-[#6C6C6C] flex gap-x-1', referenceClassName)}>
          <span className="line-through" aria-label="Najniższa cena z 30 dni przed obniżką">
            <PriceFormatter amount={promo.referencePrice} className="font-normal" />
          </span>
          {showPercent && <span>-{promo.percent}%</span>}
        </div>
      )}
      {suffix}
    </div>
  )
})
