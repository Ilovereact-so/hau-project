import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from './utils'

/**
 * Rozbija sformatowaną wartość na liczbę i jednostkę („12 345 zł” →
 * „12 345” + „zł”, „12,5%” → „12,5” + „%”). Wszystko do OSTATNIEJ cyfry
 * to liczba — wersja z meblove ucinała miliony („1 234 567 zł” →
 * „1 234” + „567 zł”) i gubiła wartości bez cyfr („—”).
 */
function splitValue(value: string): [string, string] {
  const match = value.match(/^(.*\d)\s*([^\d]*)$/)
  if (!match) return [value, '']
  return [match[1].trim(), match[2].trim()]
}

/**
 * Karta „Highlights”: rząd górny — ikona + etykieta + chip delty;
 * rząd dolny — duża wartość + mini-wykres.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  delta,
  tone = 'neutral',
  chart,
  href,
  className,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  unit?: string
  delta?: string
  tone?: 'up' | 'down' | 'neutral'
  chart?: React.ReactNode
  href?: string
  className?: string
}) {
  const toneClass = {
    up: 'text-success bg-success/10',
    down: 'text-danger bg-danger/10',
    neutral: 'text-text-2 bg-surface-muted',
  }[tone]
  const [number, suffix] = splitValue(String(value))

  const body = (
    <>
      <div className="flex items-center gap-2">
        <Icon size={15} strokeWidth={1.5} className="shrink-0 text-text-2" />
        <span className="min-w-[40%] flex-1 truncate text-xs font-semibold text-text-2" title={label}>
          {label}
        </span>
        {delta && (
          <span
            className={cn('max-w-[58%] shrink-0 truncate rounded-full px-1.5 py-px text-[10px] font-medium whitespace-nowrap', toneClass)}
            title={delta}
          >
            {delta}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="flex min-w-0 items-baseline gap-1">
          <strong className="truncate text-[28px] leading-none font-semibold tracking-tight text-text">{number}</strong>
          {suffix && <span className="text-[16px] font-medium text-text-2/70">{suffix}</span>}
          {unit && <span className="text-[16px] font-medium text-text-2/70">{unit}</span>}
        </span>
        {chart}
      </div>
    </>
  )

  const classes = cn(
    'block rounded-md border border-border/70 p-4',
    'transition-colors duration-150 ease-(--ease) hover:border-border-strong',
    className
  )

  if (href) {
    return (
      <a href={href} className={classes}>
        {body}
      </a>
    )
  }
  return <div className={classes}>{body}</div>
}
