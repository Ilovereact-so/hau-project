'use client'

/*
 * Wykresy panelu — rysowane w SVG bez biblioteki (port z meblove):
 * RevenueChart („Progress Overview”), DonutChart („Weekly Activity Split”),
 * BarList (poziome słupki) i ColumnChart (pionowe słupki).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { formatCurrency } from './kit/format'

const ACCENT = '#F59E0B'
export const CHART_COLORS = ['#F59E0B', '#3B82F6', '#EC4899', '#8B5CF6', '#22C55E', '#EF4444', '#9CA3AF']

function useMeasuredWidth(initial = 720) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(initial)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(280, entry.contentRect.width))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return { ref, width }
}

function shortMoney(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} mln`
  if (value >= 1_000) return `${(value / 1_000).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} tys.`
  return value.toLocaleString('pl-PL')
}

function parseDay(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

// ─── przychód w czasie ────────────────────────────────────────────────────────

const PAD = { top: 12, right: 10, bottom: 26, left: 62 }
const HEIGHT = 260

type Point = { x: number; y: number; value: number; count: number; date: string }

export type DailyPoint = { date: string; revenue: number; count: number }

export function RevenueChart({ daily }: { daily: DailyPoint[] }) {
  const { ref, width } = useMeasuredWidth()
  const [hover, setHover] = useState<number | null>(null)
  const innerWidth = Math.max(80, width - PAD.left - PAD.right)
  const innerHeight = HEIGHT - PAD.top - PAD.bottom

  const { points, max, ticks } = useMemo(() => {
    const values = daily.map((entry) => entry.revenue || 0)
    const peak = Math.max(1, ...values)
    const stepX = daily.length > 1 ? innerWidth / (daily.length - 1) : innerWidth
    const list: Point[] = daily.map((entry, index) => ({
      x: PAD.left + index * stepX,
      y: PAD.top + innerHeight - ((entry.revenue || 0) / peak) * innerHeight,
      value: entry.revenue || 0,
      count: entry.count || 0,
      date: entry.date,
    }))
    return {
      points: list,
      max: peak,
      ticks: [1, 0.75, 0.5, 0.25, 0].map((ratio) => ({
        ratio,
        y: PAD.top + innerHeight - ratio * innerHeight,
        label: shortMoney(Math.round(peak * ratio)),
      })),
    }
  }, [daily, innerWidth, innerHeight])

  if (!daily.length) {
    return (
      <p className="flex h-[220px] items-center justify-center text-sm text-text-2">
        Brak danych o przychodach w tym okresie.
      </p>
    )
  }

  const hasRevenue = daily.some((entry) => entry.revenue > 0)
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${PAD.top + innerHeight} L${points[0].x.toFixed(1)},${PAD.top + innerHeight} Z`

  const last = points.length - 1
  const xLabelIndexes = Array.from(new Set([0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => Math.round(last * f))))

  const active = hover !== null ? points[hover] : null
  const previous = hover !== null && hover > 0 ? points[hover - 1] : null
  const deltaPct =
    active && previous && previous.value > 0 ? Math.round(((active.value - previous.value) / previous.value) * 100) : null

  const onMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const stepX = points.length > 1 ? innerWidth / (points.length - 1) : innerWidth
    const index = Math.round((x - PAD.left) / stepX)
    setHover(Math.min(last, Math.max(0, index)))
  }

  return (
    <div
      ref={ref}
      className="relative mt-3 select-none"
      style={{ height: HEIGHT }}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
      role="img"
      aria-label="Wykres przychodów w czasie"
    >
      <svg width={width} height={HEIGHT} className="block">
        <defs>
          <linearGradient id="revenue-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={ACCENT} stopOpacity="0.32" />
            <stop offset="1" stopColor={ACCENT} stopOpacity="0" />
          </linearGradient>
          <pattern id="revenue-hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--adm-border)" strokeWidth="1" />
          </pattern>
          <clipPath id="revenue-above">
            <path
              d={`M${PAD.left},${PAD.top} L${PAD.left + innerWidth},${PAD.top} L${PAD.left + innerWidth},${PAD.top + innerHeight} ${[...points]
                .reverse()
                .map((point) => `L${point.x.toFixed(1)},${point.y.toFixed(1)}`)
                .join(' ')} Z`}
            />
          </clipPath>
        </defs>

        <rect x={PAD.left} y={PAD.top} width={innerWidth} height={innerHeight} fill="url(#revenue-hatch)" opacity="0.5" clipPath="url(#revenue-above)" />

        {ticks.map((tick) => (
          <g key={tick.ratio}>
            <line x1={PAD.left} x2={PAD.left + innerWidth} y1={tick.y} y2={tick.y} stroke="var(--adm-border)" strokeWidth="1" />
            <text x={PAD.left - 10} y={tick.y + 3} textAnchor="end" fontSize="10" fill="var(--adm-text-2)" opacity="0.7">
              {tick.label}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="url(#revenue-area)" />
        <path d={linePath} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((point, index) =>
          index % Math.max(1, Math.round(points.length / 8)) === 0 || index === last ? (
            <circle key={point.date} cx={point.x} cy={point.y} r="3" fill="var(--adm-surface)" stroke={ACCENT} strokeWidth="1.6" />
          ) : null
        )}

        {active && (
          <g>
            <line x1={active.x} x2={active.x} y1={PAD.top} y2={PAD.top + innerHeight} stroke={ACCENT} strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
            <circle cx={active.x} cy={active.y} r="4.5" fill={ACCENT} stroke="var(--adm-surface)" strokeWidth="2" />
          </g>
        )}

        {xLabelIndexes.map((index) => (
          <text
            key={index}
            x={points[index].x}
            y={HEIGHT - 8}
            textAnchor={index === 0 ? 'start' : index === last ? 'end' : 'middle'}
            fontSize="10"
            fill="var(--adm-text-2)"
            opacity="0.7"
          >
            {parseDay(points[index].date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
          </text>
        ))}
      </svg>

      {!hasRevenue && (
        <p className="absolute inset-x-0 top-0 m-0 grid h-[calc(100%-26px)] place-items-center text-sm text-text-2">
          Brak przychodu w tym okresie.
        </p>
      )}

      {active && (
        <div
          className="pointer-events-none absolute z-10 w-[172px] rounded-xs border border-border bg-surface p-2.5 shadow-2"
          style={{
            left: Math.min(Math.max(active.x - 86, 0), Math.max(0, width - 172)),
            top: Math.max(4, active.y - 110),
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-medium text-text">
              {parseDay(active.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {deltaPct !== null && (
              <span
                className={
                  deltaPct >= 0
                    ? 'rounded-full border border-success/20 bg-success/10 px-1.5 py-px text-[9px] font-medium text-success'
                    : 'rounded-full border border-danger/20 bg-danger/10 px-1.5 py-px text-[9px] font-medium text-danger'
                }
              >
                {deltaPct >= 0 ? '+' : '−'}
                {Math.abs(deltaPct)}%
              </span>
            )}
          </div>
          <div className="mt-1.5 text-xs font-semibold text-text">{formatCurrency(active.value)}</div>
          <div className="text-[11px] text-text-2">
            {active.count} {active.count === 1 ? 'zamówienie' : 'zamówień'}
          </div>
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-track">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (active.value / max) * 100)}%` }} />
          </span>
        </div>
      )}
    </div>
  )
}

// ─── pierścień ────────────────────────────────────────────────────────────────

const SIZE = 168
const STROKE = 22
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP = 3

export function DonutChart({
  values,
  labels,
  centerLabel = 'Zamówienia',
  emptyText = 'Brak zamówień w tym okresie.',
}: {
  values: Record<string, number>
  labels: Record<string, string>
  centerLabel?: string
  emptyText?: string
}) {
  const entries = Object.entries(values).filter(([, count]) => count > 0)
  const total = entries.reduce((sum, [, count]) => sum + count, 0)

  if (!total) {
    return <p className="flex h-[200px] items-center justify-center text-sm text-text-2">{emptyText}</p>
  }

  let offset = 0
  const segments = entries.map(([key, count], index) => {
    const fraction = count / total
    const length = Math.max(0, fraction * CIRCUMFERENCE - (entries.length > 1 ? GAP : 0))
    const segment = {
      key,
      count,
      color: CHART_COLORS[index % CHART_COLORS.length],
      pct: Math.round(fraction * 100),
      dash: `${length} ${CIRCUMFERENCE - length}`,
      offset: -offset,
    }
    offset += fraction * CIRCUMFERENCE
    return segment
  })

  return (
    <div className="flex flex-col items-center gap-4 pt-2">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} role="img" aria-label={`${centerLabel}: podział`} className="-rotate-90">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--adm-track)" strokeWidth={STROKE} />
          {segments.map((segment) => (
            <circle
              key={segment.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={segment.color}
              strokeWidth={STROKE}
              strokeDasharray={segment.dash}
              strokeDashoffset={segment.offset}
              strokeLinecap={entries.length > 1 ? 'round' : 'butt'}
            />
          ))}
        </svg>
        <span className="absolute inset-0 grid place-content-center text-center">
          <span className="text-[11px] font-medium text-text-2">{centerLabel}</span>
          <strong className="text-[30px] leading-tight font-semibold tracking-tight text-text">{total}</strong>
        </span>
      </div>

      <ul className="m-0 grid w-full list-none grid-cols-2 gap-x-3 gap-y-2 p-0">
        {segments.map((segment) => (
          <li key={segment.key} className="flex min-w-0 items-center gap-1.5 text-[11px] text-text-2" title={`${segment.count}`}>
            <i className="size-2 shrink-0 rounded-full" style={{ background: segment.color }} aria-hidden />
            <span className="truncate">{labels[segment.key] || segment.key}:</span>
            <b className="shrink-0 font-semibold text-text">{segment.pct}%</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── słupki ───────────────────────────────────────────────────────────────────

/** Poziome słupki „etykieta — pasek — wartość” (CategoryBars z meblove). */
export function BarList({
  rows,
  empty = 'Brak danych w tym okresie.',
  prefix = '',
  suffix = '',
  currency = false,
}: {
  rows: Array<{ label: string; value: number; hint?: string }>
  empty?: string
  /* Formatowanie opisane danymi, nie funkcją — komponent bywa renderowany
     z server componentu, a funkcji nie da się przekazać przez granicę RSC. */
  prefix?: string
  suffix?: string
  currency?: boolean
}) {
  const format = (value: number) => `${prefix}${currency ? formatCurrency(value) : value.toLocaleString('pl-PL')}${suffix}`
  if (!rows.length) return <p className="text-sm text-text-2">{empty}</p>
  const max = Math.max(1, ...rows.map((row) => row.value))
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`} className="grid grid-cols-[minmax(88px,160px)_minmax(60px,1fr)_auto] items-center gap-3 text-xs" title={row.hint}>
          <span className="truncate text-text-2">{row.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-track">
            <span
              className="block h-full rounded-full transition-[width] duration-200 ease-(--ease)"
              style={{ width: `${Math.max(row.value > 0 ? 4 : 0, (row.value / max) * 100)}%`, background: CHART_COLORS[index % CHART_COLORS.length] }}
            />
          </span>
          <strong className="text-right font-semibold whitespace-nowrap text-text">{format(row.value)}</strong>
        </div>
      ))}
    </div>
  )
}

/** Pionowe słupki z podpisami (np. zamówienia wg godziny). */
export function ColumnChart({
  columns,
  height = 150,
  unit = '',
}: {
  columns: Array<{ label: string; value: number; showLabel?: boolean }>
  height?: number
  unit?: string
}) {
  const max = Math.max(1, ...columns.map((column) => column.value))
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {columns.map((column, index) => (
        <div key={index} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${column.label}: ${column.value}${unit}`}>
          <div
            className="w-full rounded-t-[4px] transition-[height] duration-200 ease-(--ease)"
            style={{
              height: `${Math.max(3, (column.value / max) * (height - 18))}px`,
              background: ACCENT,
              opacity: column.value > 0 ? 0.35 + (column.value / max) * 0.65 : 0.15,
            }}
          />
          <span className="h-3 text-[10px] leading-3 text-text-2">{column.showLabel === false ? '' : column.label}</span>
        </div>
      ))}
    </div>
  )
}
