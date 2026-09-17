import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from './utils'

export function Card({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('rounded-md border border-border bg-surface-muted', className)} {...props} />
}

/** Nagłówek karty: tytuł (+ podtytuł, + ikona) po lewej, akcje po prawej. */
export function CardHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  className,
}: {
  icon?: LucideIcon
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 px-4 pt-4', className)}>
      <div className="flex min-w-0 items-start gap-2">
        {Icon && <Icon size={16} strokeWidth={1.5} className="mt-px shrink-0 text-text-2" />}
        <div className="min-w-0">
          <h2 className="m-0 truncate text-sm font-semibold tracking-tight text-text">{title}</h2>
          {subtitle && <p className="mt-1 mb-0 text-xs text-text-2">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Tło pod grupą pigułek/przycisków w nagłówku karty (jak w referencji). */
export function ActionTray({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('flex flex-wrap gap-2 rounded-sm bg-surface px-1 py-1', className)} {...props} />
}

export function CardBody({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('px-4 pb-4 pt-3', className)} {...props} />
}

/** Nagłówek sekcji strony (np. „Podsumowanie” + akcja po prawej). */
export function SectionHeader({
  title,
  actions,
  className,
}: {
  title: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <h2 className="m-0 text-sm font-semibold tracking-tight text-text">{title}</h2>
      {actions}
    </div>
  )
}

/** Wiersz „etykieta → wartość” (podsumowania kwot). */
export function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'success' | 'danger' }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn(strong ? 'font-semibold text-text' : 'text-text-2', tone === 'success' && 'text-success')}>{label}</dt>
      <dd
        className={cn(
          strong ? 'font-semibold text-text' : 'font-medium text-text',
          tone === 'success' && 'text-success',
          tone === 'danger' && 'text-danger'
        )}
      >
        {value}
      </dd>
    </div>
  )
}

/** Pole opisowe: mała etykieta nad treścią. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="block text-[11px] font-medium text-text-2">{label}</span>
      <div className="mt-1 text-text">{children}</div>
    </div>
  )
}

/** Prosta lista „etykieta → liczba”. */
export function Tally({ title, rows }: { title: string; rows: Array<{ label: string; value: string }> }) {
  return (
    <div>
      <span className="block text-[11px] font-medium text-text-2">{title}</span>
      {rows.length ? (
        <dl className="mt-2 flex flex-col gap-1.5 text-xs">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3">
              <dt className="min-w-0 truncate text-text-2">{row.label}</dt>
              <dd className="shrink-0 font-medium text-text">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-xs text-text-2">Brak danych w tym okresie.</p>
      )}
    </div>
  )
}
