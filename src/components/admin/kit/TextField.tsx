import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from './utils'

export const FIELD_BASE =
  'rounded-xs border border-border bg-surface text-sm text-text outline-none' +
  ' transition-colors duration-150 ease-(--ease) placeholder:text-muted' +
  ' focus:border-border-strong focus:ring-2 focus:ring-primary/25' +
  ' disabled:opacity-60'

type FieldChrome = { label: string; hint?: React.ReactNode; error?: string }

function Chrome({ label, hint, error, children }: FieldChrome & { children: React.ReactNode }) {
  return (
    <label className="grid min-w-0 content-start gap-1.5">
      <span className="truncate text-xs font-medium text-text-2" title={label}>
        {label}
      </span>
      {children}
      {error ? (
        <span className="text-[11px] text-danger">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-text-2">{hint}</span>
      ) : undefined}
    </label>
  )
}

export function TextField({
  label,
  hint,
  error,
  className,
  ...props
}: React.ComponentPropsWithoutRef<'input'> & FieldChrome) {
  return (
    <Chrome label={label} hint={hint} error={error}>
      <input
        className={cn('h-10 w-full min-w-0 px-3', FIELD_BASE, error && 'border-danger/60 focus:ring-danger/25', className)}
        {...props}
      />
    </Chrome>
  )
}

export function TextAreaField({
  label,
  hint,
  error,
  className,
  ...props
}: React.ComponentPropsWithoutRef<'textarea'> & FieldChrome) {
  return (
    <Chrome label={label} hint={hint} error={error}>
      <textarea
        className={cn('min-h-20 w-full min-w-0 resize-y px-3 py-2.5', FIELD_BASE, error && 'border-danger/60', className)}
        {...props}
      />
    </Chrome>
  )
}

export function SelectField({
  label,
  hint,
  error,
  options,
  className,
  ...props
}: React.ComponentPropsWithoutRef<'select'> &
  FieldChrome & { options: Array<{ value: string; label: string }> }) {
  return (
    <Chrome label={label} hint={hint} error={error}>
      <span className="relative flex min-w-0">
        <select className={cn('pill h-10 w-full min-w-0 pr-8 pl-3', FIELD_BASE, className)} {...props}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown size={14} strokeWidth={1.5} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted" />
      </span>
    </Chrome>
  )
}

/** Małe pole w komórce tabeli (stan magazynu, cena). */
export function CellInput({ className, ...props }: React.ComponentPropsWithoutRef<'input'>) {
  return <input className={cn('h-8 px-2.5 text-xs', FIELD_BASE, className)} {...props} />
}
