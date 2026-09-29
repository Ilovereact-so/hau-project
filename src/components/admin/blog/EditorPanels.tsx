'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, Circle, Info, type LucideIcon } from 'lucide-react'
import {
  SITE_TITLE_SUFFIX,
  effectiveSeo,
  type GuideCheck,
  type GuideHeading,
  type GuideStats,
} from '@/lib/guides/content'
import { SITE_URL } from '@/lib/site'
import { cn } from '../kit/utils'

/*
 * Panele boczne edytora: sekcja (zwijana karta), podgląd wyniku w Google,
 * lista kontrolna SEO, konspekt i statystyki tekstu.
 */

export function Panel({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  aside,
}: {
  title: string
  icon?: LucideIcon
  children: React.ReactNode
  defaultOpen?: boolean
  aside?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="rounded-md border border-border bg-surface-muted">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        {Icon && <Icon size={15} strokeWidth={1.75} className="shrink-0 text-text-2" />}
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text">{title}</span>
        {aside}
        <ChevronDown size={14} strokeWidth={1.75} className={cn('shrink-0 text-text-2 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="grid gap-3 px-4 pb-4">{children}</div>}
    </section>
  )
}

/** Tak mniej więcej wygląda wynik w Google (tytuł ucięty ~60 znaków, opis ~160). */
export function SearchPreview({
  title,
  excerpt,
  seoTitle,
  seoDescription,
  slug,
}: {
  title: string
  excerpt: string
  seoTitle: string
  seoDescription: string
  slug: string
}) {
  const seo = effectiveSeo({ title, excerpt, seoTitle, seoDescription })
  const host = SITE_URL.replace(/^https?:\/\//, '')
  const shownTitle = seo.title.length > 62 ? `${seo.title.slice(0, 60).trimEnd()}…` : seo.title
  const shownDescription = seo.description.length > 160 ? `${seo.description.slice(0, 157).trimEnd()}…` : seo.description
  return (
    <div className="rounded-sm border border-border bg-bg p-3" aria-label="Podgląd w wynikach Google">
      <div className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-full bg-surface-muted text-[10px] font-bold text-text">H</span>
        <span className="min-w-0 leading-tight">
          <span className="block text-[12px] text-text">HAU</span>
          <span className="block truncate text-[11px] text-text-2">
            {host} › poradniki › {slug || '…'}
          </span>
        </span>
      </div>
      <p className="m-0 mt-2 text-[16px] leading-snug text-[#1a0dab] [.dark_&]:text-[#8ab4f8]">
        {title.trim() || seoTitle.trim() ? shownTitle : `Tytuł artykułu${SITE_TITLE_SUFFIX}`}
      </p>
      <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-text-2">
        {shownDescription || 'Tu pojawi się zajawka artykułu — opis w wynikach wyszukiwania.'}
      </p>
    </div>
  )
}

const LEVEL_ICON: Record<GuideCheck['level'], { icon: LucideIcon; className: string }> = {
  ok: { icon: CheckCircle2, className: 'text-success' },
  info: { icon: Info, className: 'text-info' },
  warn: { icon: AlertCircle, className: 'text-[#d97706]' },
  error: { icon: AlertCircle, className: 'text-danger' },
}

/** Wynik 0–100: błędy ważą najwięcej, podpowiedzi prawie nic. */
export function checksScore(checks: GuideCheck[]) {
  if (!checks.length) return 100
  const weights = { ok: 1, info: 0.8, warn: 0.45, error: 0 }
  return Math.round((checks.reduce((sum, check) => sum + weights[check.level], 0) / checks.length) * 100)
}

export function ChecksList({ checks }: { checks: GuideCheck[] }) {
  const order = { error: 0, warn: 1, info: 2, ok: 3 }
  const sorted = [...checks].sort((a, b) => order[a.level] - order[b.level])
  return (
    <ul className="m-0 grid list-none gap-2 p-0">
      {sorted.map((check) => {
        const { icon: Icon, className } = LEVEL_ICON[check.level]
        return (
          <li key={check.id} className="flex gap-2">
            <Icon size={15} strokeWidth={2} className={cn('mt-px shrink-0', className)} />
            <span className="min-w-0">
              <span className="block text-xs font-medium text-text">{check.label}</span>
              {check.detail && check.level !== 'ok' && <span className="block text-[11px] leading-relaxed text-text-2">{check.detail}</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 80 ? 'bg-success/15 text-success' : score >= 55 ? 'bg-[#d97706]/15 text-[#d97706]' : 'bg-danger/15 text-danger'
  return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', tone)}>{score}/100</span>
}

export function Outline({ headings, onJump }: { headings: GuideHeading[]; onJump: (key: string) => void }) {
  if (!headings.length) {
    return (
      <p className="m-0 text-xs text-text-2">
        Brak śródtytułów. Wpisz „## ” na początku akapitu albo wybierz „Nagłówek sekcji (H2)” z paska — z nagłówków powstaje spis treści artykułu.
      </p>
    )
  }
  return (
    <ol className="m-0 grid list-none gap-0.5 p-0">
      {headings.map((heading) => (
        <li key={heading.key}>
          <button
            type="button"
            onClick={() => onJump(heading.key)}
            className={cn(
              'flex w-full items-start gap-1.5 rounded-xs px-2 py-1 text-left text-xs hover:bg-surface',
              heading.level === 2 ? 'font-medium text-text' : 'text-text-2',
              heading.level === 3 && 'pl-5',
              heading.level === 4 && 'pl-8'
            )}
          >
            <Circle size={6} strokeWidth={0} className="mt-[5px] shrink-0 fill-current opacity-50" />
            <span className="min-w-0">{heading.text}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}

export function StatsGrid({ stats, readingTime }: { stats: GuideStats; readingTime: number }) {
  const items = [
    { label: 'Słowa', value: stats.words.toLocaleString('pl-PL') },
    { label: 'Czas czytania', value: `${readingTime} min` },
    { label: 'Śródtytuły', value: String(stats.headings) },
    { label: 'Zdjęcia', value: String(stats.images) },
    { label: 'Linki do sklepu', value: String(stats.internalLinks) },
    { label: 'Ramki / produkty', value: `${stats.callouts} / ${stats.productEmbeds}` },
  ]
  return (
    <dl className="m-0 grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-xs border border-border bg-bg px-2.5 py-2">
          <dt className="text-[10.5px] text-text-2">{item.label}</dt>
          <dd className="m-0 text-sm font-semibold text-text">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

