import { cn } from '@/lib/utils'
import { Paw_Empty, Paw_Filled } from '@/components/ui/paw'
import { REVIEW_RATING_MAX, formatAverage } from '@/lib/reviewsShared'

type Props = {
  /** Ocena 0–5, może być ułamkowa (średnia). */
  value: number
  /** Rozmiar pojedynczej łapki, np. `w-6 h-6`. */
  pawClassName?: string
  /** Kolor wypełnienia i obrysu. */
  colorClassName?: string
  className?: string
  /** Własny opis dla czytników ekranu. */
  label?: string
}

/**
 * Ocena w łapkach z dokładnym wypełnieniem ułamków (4,3 → 4 pełne + 30% piątej).
 *
 * Każda łapka to obrys + wypełniona kopia przycięta szerokością kontenera
 * (`overflow-hidden`). Bez `<defs>`/gradientów — te wymagają unikalnych `id`,
 * a przy kilkudziesięciu kafelkach na stronie (i ukrytych wariantach mobile)
 * pierwszy gradient w `display:none` potrafił „zgasić” wszystkie pozostałe.
 * Komponent nie używa hooków, więc działa i w server, i w client components.
 */
export function PawRating({
  value,
  pawClassName = 'w-6 h-6',
  colorClassName = 'text-[#6EB0A6]',
  className,
  label,
}: Props) {
  const safe = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), REVIEW_RATING_MAX)

  return (
    <span
      role="img"
      aria-label={label ?? `Ocena ${formatAverage(safe)} na ${REVIEW_RATING_MAX}`}
      className={cn('inline-flex items-center gap-1', colorClassName, className)}
    >
      {Array.from({ length: REVIEW_RATING_MAX }, (_, i) => {
        const fill = Math.min(Math.max(safe - i, 0), 1)
        return (
          <span key={i} className={cn('relative inline-block shrink-0', pawClassName)} aria-hidden="true">
            <Paw_Empty className="absolute inset-0 h-full w-full" />
            {fill > 0 && (
              <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${Math.round(fill * 100)}%` }}>
                <Paw_Filled className={cn('block max-w-none', pawClassName)} />
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

export default PawRating
