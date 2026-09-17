'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useClickOutside } from '@/hooks/useClickOutside'
import {
  DEFAULT_PRODUCT_SORT,
  PRODUCT_SORTS,
  PRODUCT_SORT_LABELS,
  type ProductSort,
} from '@/lib/productSort'

/**
 * Wybór sortowania listingu. Steruje parametrem `?sort=` w adresie, więc
 * porządek liczy serwer (patrz lib/productListing.ts), a wybór da się
 * zalinkować, odświeżyć i cofnąć przyciskiem „wstecz”. Pozostałe parametry
 * (filtry, fraza wyszukiwania) zostają nietknięte.
 */
export default function SortSelect({
  value,
  className,
  buttonClassName,
}: {
  value: ProductSort
  className?: string
  buttonClassName?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<ProductSort | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const close = useCallback(() => setOpen(false), [])
  useClickOutside(boxRef, close)

  // Po zakończeniu nawigacji (nowy `value` z serwera) gasimy stan „zmieniam”.
  useEffect(() => {
    setPending(null)
  }, [value])

  const select = (next: ProductSort) => {
    setOpen(false)
    if (next === value) return
    setPending(next)
    const params = new URLSearchParams(searchParams.toString())
    // Domyślnego sortowania nie zapisujemy w adresie — czysty link do kategorii.
    if (next === DEFAULT_PRODUCT_SORT) params.delete('sort')
    else params.set('sort', next)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const current = pending ?? value

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Sortowanie: ${PRODUCT_SORT_LABELS[current]}`}
        className={cn(
          'flex items-center gap-2 xs:text-[clamp(15px,1.4vw,17px)] text-[14px] text-black bg-[#f4f4f4] 3xs:px-8 px-6 py-2 h-fit rounded-[20px] font-medium cursor-pointer whitespace-nowrap',
          'transition-opacity',
          pending && 'opacity-70',
          open && ' rounded-[20px] rounded-b-none',
          buttonClassName,
        )}
      >
        {PRODUCT_SORT_LABELS[current]}
        <ChevronDown className={cn('w-[16px] h-[16px] transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div className='w-[40px] h-[40px] absolute bottom-0 left-0 translate-x-[-100%] overflow-hidden'>
          <div className='rounded-br-[20px] shadow_sort w-full h-full'></div>
        </div>
      )}
      {open && (
        <ul
          id={menuId}
          role="listbox"
          aria-label="Sortowanie produktów"
          className="absolute right-0 top-[100%] z-[20] w-[min(240px,80vw)] overflow-hidden rounded-[20px] px-2 rounded-tr-none bg-[#EDEDED] py-2 shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
        >
          {PRODUCT_SORTS.map((option) => {
            const active = option === current
            return (
              <li key={option}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => select(option)}
                  className={cn(
                    'flex w-full items-start gap-2 px-4 py-2 text-left text-black cursor-pointer',
                    'hover:bg-[#e2f3f0] focus-visible:bg-[#e2f3f0] focus-visible:outline-none',
                    active && 'bg-[#ededed]',
                  )}
                >
                  <Check
                    className={cn('mt-[3px] w-[16px] h-[16px] shrink-0', active ? 'opacity-100' : 'opacity-0')}
                    aria-hidden="true"
                  />
                  <span className="flex flex-col">
                    <span className="text-[15px] leading-tight">{PRODUCT_SORT_LABELS[option]}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
