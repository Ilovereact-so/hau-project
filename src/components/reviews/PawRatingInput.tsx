'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Paw_Empty, Paw_Filled } from '@/components/ui/paw'
import { REVIEW_RATING_MAX } from '@/lib/reviewsShared'

const HINTS = ['', 'Słabo', 'Tak sobie', 'Dobrze', 'Bardzo dobrze', 'Rewelacja']

type Props = {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  error?: string
  id?: string
}

/**
 * Wybór oceny 1–5 łapkami. Semantyka `radiogroup` z „roving tabindex”:
 * Tab wchodzi na zaznaczoną łapkę, strzałki zmieniają ocenę, Home/End skrajne.
 * Najechanie myszą pokazuje podgląd bez zmiany wartości.
 *
 * Dwie rzeczy, od których zależy, że jedno kliknięcie wystarcza:
 *  - Fokus NIE czyści podglądu. Kliknięcie najpierw daje przyciskowi fokus
 *    (mousedown), a dopiero potem `click` — czyszczenie podglądu na fokusie
 *    cofało widok do starej oceny w połowie kliknięcia.
 *  - Każda łapka ma zawsze te same elementy DOM (pełna i pusta ikona nałożone
 *    na siebie, przełączane przezroczystością, bez zdarzeń myszy). Wcześniej
 *    ikona była podmieniana między mousedown a mouseup i przeglądarka nie
 *    uznawała tego za kliknięcie — trzeba było klikać drugi raz.
 */
export function PawRatingInput({ value, onChange, disabled, error, id }: Props) {
  const [hover, setHover] = useState(0)
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const shown = hover || value
  const focusIndex = value > 0 ? value - 1 : 0

  const select = (next: number, { moveFocus }: { moveFocus: boolean }) => {
    if (disabled) return
    const clamped = Math.min(Math.max(next, 1), REVIEW_RATING_MAX)
    if (clamped !== value) onChange(clamped)
    if (moveFocus) refs.current[clamped - 1]?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    let next: number | null = null
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = (value || 0) + 1
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        next = (value || 1) - 1
        break
      case 'Home':
        next = 1
        break
      case 'End':
        next = REVIEW_RATING_MAX
        break
    }
    if (next === null) return
    event.preventDefault()
    // Klawiatura ma pierwszeństwo przed podglądem spod kursora.
    setHover(0)
    select(next, { moveFocus: true })
  }

  const onPointerEnter = (event: React.PointerEvent, n: number) => {
    // Podgląd tylko dla myszy — na dotyku „hover” zostawałby przyklejony po tapnięciu.
    if (event.pointerType === 'mouse' && !disabled) setHover(n)
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-3">
        <div
          id={id}
          role="radiogroup"
          aria-label="Twoja ocena"
          aria-invalid={Boolean(error)}
          aria-disabled={disabled || undefined}
          className="flex items-center gap-1"
          onPointerLeave={() => setHover(0)}
        >
          {Array.from({ length: REVIEW_RATING_MAX }, (_, i) => {
            const n = i + 1
            const active = n <= shown
            return (
              <button
                key={n}
                ref={(el) => {
                  refs.current[i] = el
                }}
                type="button"
                role="radio"
                aria-checked={value === n}
                aria-label={`${n} na ${REVIEW_RATING_MAX} — ${HINTS[n]}`}
                tabIndex={i === focusIndex ? 0 : -1}
                disabled={disabled}
                onClick={() => select(n, { moveFocus: false })}
                onKeyDown={onKeyDown}
                onPointerEnter={(event) => onPointerEnter(event, n)}
                className={cn(
                  'relative rounded-full p-0.5 text-[#6EB0A6] transition-transform duration-150 ease-in-out select-none touch-manipulation',
                  'hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6EB0A6]/60',
                  'disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer',
                )}
              >
                <span className="relative block sm:w-9 sm:h-9 w-8 h-8 pointer-events-none" aria-hidden="true">
                  <Paw_Empty
                    className={cn('absolute inset-0 h-full w-full transition-opacity duration-100', active ? 'opacity-0' : 'opacity-100')}
                  />
                  <Paw_Filled
                    className={cn('absolute inset-0 h-full w-full transition-opacity duration-100', active ? 'opacity-100' : 'opacity-0')}
                  />
                </span>
              </button>
            )
          })}
        </div>
        <span className="min-w-[110px] text-[14px] text-[#6C6C6C]" aria-live="polite">
          {shown ? HINTS[shown] : 'Wybierz ocenę'}
        </span>
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}

export default PawRatingInput
