import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from './utils'

/** „Pigułka” z natywnym selectem — filtry nad tabelą/wykresem. */
export function PillSelect({
  value,
  onChange,
  options,
  label,
  className,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  label: string
  className?: string
  disabled?: boolean
}) {
  return (
    <span
      className={cn(
        'relative inline-flex h-8 max-w-[190px] items-center rounded-xs border border-border bg-bg pl-2.5 pr-7 shadow-pill',
        'transition-colors duration-150 ease-(--ease) hover:border-border-strong',
        'focus-within:ring-2 focus-within:ring-primary/30',
        disabled && 'opacity-50',
        className
      )}
    >
      <select
        aria-label={label}
        disabled={disabled}
        className="pill w-full cursor-pointer truncate bg-transparent text-xs font-medium text-text outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={13} strokeWidth={1.5} className="pointer-events-none absolute right-2 text-muted" />
    </span>
  )
}

const PILL =
  'inline-flex h-8 items-center gap-1.5 rounded-xs border border-border bg-bg px-2.5 text-xs font-medium text-text-2' +
  ' transition-colors duration-150 ease-(--ease) hover:border-border-strong hover:text-text' +
  ' focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40' +
  ' disabled:pointer-events-none disabled:opacity-50'

/** Mały przycisk paska narzędzi karty (Sortuj / Filtruj / Odśwież). */
export function PillButton({
  icon: Icon,
  children,
  className,
  active,
  ...props
}: React.ComponentPropsWithoutRef<'button'> & { icon?: React.ElementType; active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(PILL, active && 'border-primary/40 text-primary', className)}
      {...props}
    >
      {Icon && <Icon size={13} strokeWidth={1.5} />}
      {children}
    </button>
  )
}

/** Pigułka z polem daty (filtr zakresu). */
export function PillDate({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="inline-flex h-8 items-center gap-1.5 rounded-xs border border-border bg-bg px-2.5 text-xs font-medium text-text-2 shadow-pill focus-within:ring-2 focus-within:ring-primary/30">
      <span>{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent text-xs text-text outline-none"
      />
    </label>
  )
}

/** Pole wyszukiwania w nagłówku karty. */
export function PillSearch({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-8 items-center gap-2 rounded-xs border border-border bg-surface px-2.5 shadow-pill focus-within:ring-2 focus-within:ring-primary/25',
        className
      )}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-muted" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        className="w-36 bg-transparent text-xs text-text outline-none placeholder:text-muted sm:w-44"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
