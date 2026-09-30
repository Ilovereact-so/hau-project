'use client'

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, Info, Loader2, TicketPercent, X } from 'lucide-react'
import useStore from 'store'
import { cn } from '@/lib/utils'
import { previewDiscountCode } from '@/actions/discounts'
import { normalizeDiscountCode } from '@/lib/discounts'
import { useDiscountStore } from '@/store/discountStore'
import type { DiscountPreviewState } from '@/hooks/useDiscountPreview'

/*
 * „Masz kod promocyjny?” w podsumowaniu koszyka. Nagłówek rozwija się w dół
 * z polem w stylu formularzy kasy. Zastosowany kod to pigułka z korzyścią
 * i „Usuń”; gdy nie spełnia warunku (próg), pokazujemy czego brakuje.
 * Kwoty liczy serwer — panel tylko pokazuje wynik `useDiscountPreview`.
 */
export default function DiscountCodePanel({
  state,
  droppedMessage,
  onDroppedSeen,
}: {
  state: DiscountPreviewState
  droppedMessage: string | null
  onDroppedSeen: () => void
}) {
  const code = useDiscountStore(s => s.code)
  const setCode = useDiscountStore(s => s.setCode)
  const cartItems = useStore(s => s.cartItems)
  const reduceMotion = useReducedMotion()
  const panelId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(Boolean(code))
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Zapisany kod przestał działać (np. wygasł) — pokaż powód w panelu.
  useEffect(() => {
    if (!droppedMessage) return
    setOpen(true)
    setError(droppedMessage)
    onDroppedSeen()
  }, [droppedMessage, onDroppedSeen])

  const apply = (event: FormEvent) => {
    event.preventDefault()
    const normalized = normalizeDiscountCode(value)
    if (!normalized) {
      setError('Wpisz kod rabatowy.')
      inputRef.current?.focus()
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await previewDiscountCode({
        code: normalized,
        items: cartItems.map(i => ({ productId: i.product._id, variantId: i.variant, qty: i.quantity })),
      })
      if (!result.ok) {
        setError(result.error)
        inputRef.current?.focus()
        return
      }
      setCode(result.code)
      setValue('')
    })
  }

  const remove = () => {
    setCode(null)
    setError(null)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const preview = state.status === 'ready' ? state.preview : null
  const loadingApplied = state.status === 'loading'

  return (
    <div className="text-black bg-[#E1E1E1] rounded-[28px] lg:mt-6 mt-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex justify-between items-center py-3 px-6 cursor-pointer text-[clamp(14px,1.4vw,16px)] font-medium"
      >
        <span className="flex items-center gap-2">
          Masz kod promocyjny?
          {code && !open && (
            <span className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-semibold tracking-wide">{code}</span>
          )}
        </span>
        <ChevronDown
          className={cn('lg:w-6 lg:h-6 w-5 h-5 transition-transform duration-300', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="px-4 pb-4 pt-1">
              {code ? (
                <AppliedCode
                  code={code}
                  loading={loadingApplied}
                  benefit={preview?.benefit}
                  description={preview?.description ?? null}
                  applicable={preview?.applicable ?? true}
                  message={preview?.message}
                  onRemove={remove}
                />
              ) : (
                <form onSubmit={apply} noValidate className="flex flex-col gap-1.5 w-auto">
                  <label htmlFor={`${panelId}-input`} className="sr-only">Kod rabatowy</label>
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      id={`${panelId}-input`}
                      value={value}
                      onChange={e => { setValue(e.target.value); if (error) setError(null) }}
                      placeholder="Wpisz kod"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      maxLength={40}
                      aria-invalid={Boolean(error) || undefined}
                      aria-describedby={error ? `${panelId}-error` : undefined}
                      className={cn(
                        'w-auto min-w-0 bg-white border text-black rounded-full px-4 sm:py-2.5 py-2',
                        'text-[clamp(14px,1.4vw,15px)] font-poppins uppercase placeholder:normal-case placeholder:text-[#BBBBBB]',
                        'focus:outline-none transition-colors',
                        error ? 'border-red-400' : 'border-black',
                      )}
                    />
                    <button
                      type="submit"
                      disabled={pending}
                      className="shrink-0 inline-flex items-center justify-center rounded-[15px] bg-fancy-black text-white p-2 font-medium cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-wait h-fit"
                    >
                      
                      {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Check size={18} className='text-white'/>}
                    </button>
                  </div>
                  {error && (
                    <p id={`${panelId}-error`} role="alert" className="px-4 text-[13px] text-red-600 text-wrap max-w-[250px]">
                      {error}
                    </p>
                  )}
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function AppliedCode({
  code,
  loading,
  benefit,
  description,
  applicable,
  message,
  onRemove,
}: {
  code: string
  loading: boolean
  benefit?: string
  description: string | null
  applicable: boolean
  message?: string
  onRemove: () => void
}) {
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <div className="flex items-center gap-3 rounded-[20px] bg-white px-4 py-3">
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full',
            applicable ? 'bg-[#e2f3f0] text-[#6EB0A6]' : 'bg-[#f1f1f1] text-[#8E8E8E]',
          )}
          aria-hidden
        >
          <TicketPercent size={18} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-[15px] font-semibold tracking-wide">
            {code}
            {loading ? (
              <Loader2 size={14} className="animate-spin text-[#8E8E8E]" aria-label="Przeliczam" />
            ) : (
              benefit && (
                <span className={cn('text-[13px] font-medium whitespace-nowrap', applicable ? 'text-[#3F8F84]' : 'text-[#8E8E8E]')}>
                  {benefit}
                </span>
              )
            )}
          </p>
          {description && <p className="text-[12px] text-[#6C6C6C] line-clamp-1">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] text-[#6C6C6C] hover:text-black hover:bg-[#f1f1f1] transition-colors cursor-pointer"
          aria-label={`Usuń kod ${code}`}
        >
          <X size={14} aria-hidden />
          Usuń
        </button>
      </div>
      {!applicable && message && (
        <p className="flex items-start gap-2 px-2 text-[13px] text-[#6C6C6C]">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
          {message}
        </p>
      )}
    </div>
  )
}
