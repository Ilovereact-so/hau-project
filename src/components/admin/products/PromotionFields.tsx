'use client'

import { BadgePercent } from 'lucide-react'
import {
  PROMOTION_MAX_PERCENT,
  applyPromotion,
  promotionState,
  type ProductPromotion,
  type PromotionState,
} from '@/lib/promotion'
import { Badge } from '../kit/Badge'
import { SelectField, TextField } from '../kit/TextField'
import { Toggle } from '../kit/Toggle'
import { formatCurrencyPrecise } from '../kit/format'

/*
 * Promocja produktu w oknie edycji — OSOBNO od ceny regularnej.
 * Zmiana „Ceny” to zwykła zmiana ceny (bez przekreślenia w sklepie);
 * przekreślenie, procent i informację Omnibus sklep pokazuje tylko
 * w czasie aktywnej promocji. Logika: lib/promotion.ts.
 */

export type PromotionDraft = {
  enabled: boolean
  discountType: 'percent' | 'price'
  value: string
  /** `YYYY-MM-DDTHH:mm` w czasie lokalnym (input datetime-local). */
  startsAt: string
  endsAt: string
}

const pad = (value: number) => String(value).padStart(2, '0')

/** ISO → wartość pola datetime-local (czas lokalny przeglądarki). */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Wartość pola datetime-local → ISO (UTC). Puste = `null`. */
export function localInputToIso(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function promotionDraftFrom(promotion: ProductPromotion | null | undefined): PromotionDraft {
  return {
    enabled: Boolean(promotion?.enabled),
    discountType: promotion?.discountType === 'price' ? 'price' : 'percent',
    value: typeof promotion?.value === 'number' ? String(promotion.value).replace('.', ',') : '',
    startsAt: isoToLocalInput(promotion?.startsAt),
    endsAt: isoToLocalInput(promotion?.endsAt),
  }
}

export function promotionFromDraft(draft: PromotionDraft): ProductPromotion {
  const text = draft.value.trim().replace(',', '.')
  const value = text ? Number(text) : null
  return {
    enabled: draft.enabled,
    discountType: draft.discountType,
    value: value !== null && Number.isFinite(value) ? value : null,
    startsAt: localInputToIso(draft.startsAt),
    endsAt: localInputToIso(draft.endsAt),
  }
}

const STATE_LABEL: Record<PromotionState, { label: string; tone: 'success' | 'info' | 'neutral' | 'primary' }> = {
  none: { label: 'brak', tone: 'neutral' },
  disabled: { label: 'wyłączona', tone: 'neutral' },
  scheduled: { label: 'zaplanowana', tone: 'info' },
  active: { label: 'trwa teraz', tone: 'success' },
  ended: { label: 'zakończona', tone: 'neutral' },
  invalid: { label: 'do poprawy', tone: 'primary' },
}

export function PromotionFields({
  draft,
  onChange,
  regularPrice,
}: {
  draft: PromotionDraft
  onChange: (next: PromotionDraft) => void
  /** Cena regularna z formularza (do podglądu ceny promocyjnej). */
  regularPrice: number | null
}) {
  const promotion = promotionFromDraft(draft)
  const state = promotionState(promotion)
  const status = STATE_LABEL[state]
  // Podgląd liczony dla aktywnej promocji (bez dat), żeby było widać cenę także przy zaplanowanej.
  const preview =
    regularPrice && regularPrice > 0 && draft.enabled
      ? applyPromotion(regularPrice, { ...promotion, startsAt: null, endsAt: null })
      : null
  const set = (patch: Partial<PromotionDraft>) => onChange({ ...draft, ...patch })

  return (
    <div className="flex flex-col gap-3 rounded-xs border border-border bg-surface-muted px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-text">
          <Toggle checked={draft.enabled} onChange={() => set({ enabled: !draft.enabled })} label="Promocja" />
          <BadgePercent size={14} strokeWidth={1.75} className="text-text-2" />
          Promocja
        </label>
        {draft.enabled && <Badge tone={status.tone}>{status.label}</Badge>}
      </div>

      {draft.enabled ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Rodzaj"
              value={draft.discountType}
              onChange={(event) => set({ discountType: event.target.value === 'price' ? 'price' : 'percent' })}
              options={[
                { value: 'percent', label: 'Procent od ceny' },
                { value: 'price', label: 'Cena promocyjna (zł)' },
              ]}
            />
            <TextField
              label={draft.discountType === 'percent' ? 'Obniżka (%)' : 'Cena promocyjna (zł)'}
              inputMode="decimal"
              value={draft.value}
              onChange={(event) => set({ value: event.target.value })}
              placeholder={draft.discountType === 'percent' ? `1–${PROMOTION_MAX_PERCENT}` : 'np. 39,99'}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Początek"
              type="datetime-local"
              value={draft.startsAt}
              onChange={(event) => set({ startsAt: event.target.value })}
              hint="Puste = od razu."
            />
            <TextField
              label="Koniec"
              type="datetime-local"
              value={draft.endsAt}
              onChange={(event) => set({ endsAt: event.target.value })}
              hint="Puste = do wyłączenia."
            />
          </div>
          <p className="m-0 text-[11px] leading-[1.6] text-text-2">
            {preview !== null && regularPrice && preview < regularPrice ? (
              <>
                Cena w promocji: <strong className="text-text">{formatCurrencyPrecise(preview)}</strong> zamiast{' '}
                {formatCurrencyPrecise(regularPrice)}
                {draft.discountType === 'price' ? ' (warianty tańsze od ceny promocyjnej zostają bez zmian)' : ' — dla każdego wariantu osobno'}.{' '}
              </>
            ) : state === 'invalid' || (preview !== null && regularPrice && preview >= regularPrice) ? (
              <>Ta promocja nie obniża ceny — sprawdź wartość. </>
            ) : null}
            Sklep pokaże przekreśloną najniższą cenę z 30 dni przed promocją, procent i informację Omnibus — tylko w czasie trwania promocji.
          </p>
        </>
      ) : (
        <p className="m-0 text-[11px] leading-[1.6] text-text-2">
          Bez promocji sklep pokazuje samą cenę. Zmiana pola „Cena” to zwykła zmiana ceny — bez przekreślenia i bez informacji o najniższej cenie.
        </p>
      )}
    </div>
  )
}
