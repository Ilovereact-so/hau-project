'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ArrowDown, ArrowUp, ChevronDown, ChevronRight, ExternalLink, Eye, EyeOff, GripVertical, ListTree, RotateCcw, Save,
} from 'lucide-react'
import { adminSaveMenu } from '@/actions/adminMenu'
import type { MenuEditorCategory, MenuEditorData, MenuEditorSubcategory } from '@/lib/admin/menu'
import type { MenuLayoutInput } from '@/lib/menuOrder'
import { Badge } from '../kit/Badge'
import { Button, IconButton } from '../kit/Button'
import { Card, CardHeader } from '../kit/Card'
import { EmptyState, ErrorBox, NoticeBox } from '../kit/EmptyState'
import { cn } from '../kit/utils'

/*
 * Produkty → Menu sklepu. Kolejność (przeciąganie za uchwyt albo strzałki)
 * i widoczność (oko) kategorii i podkategorii w nawigacji sklepu. Zmiany
 * trafiają do sklepu po „Zapisz” — jedną transakcją w Sanity
 * (`lib/admin/menu.ts`), z odświeżeniem menu bez czekania na cache.
 * Podkategorie przestawia się w obrębie ich kategorii; przeniesienie do innej
 * kategorii to zmiana „Parent category” w Studio.
 */

const toLayout = (categories: MenuEditorCategory[]): MenuLayoutInput => ({
  categories: categories.map((category) => ({
    id: category.id,
    hidden: category.hidden,
    subcategories: category.subcategories.map((sub) => ({ id: sub.id, hidden: sub.hidden })),
  })),
})

const snapshot = (categories: MenuEditorCategory[]) => JSON.stringify(toLayout(categories))

function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

type DragState = { level: 'category'; index: number } | { level: 'sub'; parentId: string; index: number } | null

export function MenuEditor({ initial }: { initial: MenuEditorData }) {
  const router = useRouter()
  const [categories, setCategories] = useState(initial.categories)
  const [customized, setCustomized] = useState(initial.customized)
  const [saved, setSaved] = useState(() => snapshot(initial.categories))
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState('')
  const [saving, startSaving] = useTransition()
  const drag = useRef<DragState>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)

  const dirty = snapshot(categories) !== saved

  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const stats = useMemo(() => {
    const hiddenCategories = categories.filter((c) => c.hidden).length
    const subs = categories.reduce((sum, c) => sum + c.subcategories.length, 0)
    const hiddenSubs = categories.reduce((sum, c) => sum + c.subcategories.filter((s) => s.hidden).length, 0)
    return { hiddenCategories, subs, hiddenSubs }
  }, [categories])

  // ─── zmiany ────────────────────────────────────────────────────────────────

  const moveCategory = (from: number, to: number) => setCategories((current) => moveItem(current, from, to))

  const moveSub = (parentId: string, from: number, to: number) =>
    setCategories((current) =>
      current.map((c) => (c.id === parentId ? { ...c, subcategories: moveItem(c.subcategories, from, to) } : c)),
    )

  const toggleCategory = (id: string) =>
    setCategories((current) => current.map((c) => (c.id === id ? { ...c, hidden: !c.hidden } : c)))

  const toggleSub = (parentId: string, id: string) =>
    setCategories((current) =>
      current.map((c) =>
        c.id === parentId ? { ...c, subcategories: c.subcategories.map((s) => (s.id === id ? { ...s, hidden: !s.hidden } : s)) } : c,
      ),
    )

  const toggleExpanded = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allExpanded = categories.length > 0 && categories.every((c) => expanded.has(c.id))

  const reset = () => {
    if (!window.confirm('Cofnąć niezapisane zmiany w menu?')) return
    setCategories(initialFromSaved(saved, categories))
  }

  const save = () =>
    startSaving(async () => {
      setError('')
      const result = await adminSaveMenu(toLayout(categories))
      if (!result.ok) {
        setError(result.error)
        return
      }
      setCategories(result.data.data.categories)
      setCustomized(result.data.data.customized)
      setSaved(snapshot(result.data.data.categories))
      toast.success(result.data.changed ? 'Menu zapisane — sklep pokazuje nową kolejność' : 'Bez zmian do zapisania')
      router.refresh()
    })

  // ─── przeciąganie (HTML5, w obrębie jednego poziomu) ───────────────────────

  const onDragStart = (state: NonNullable<DragState>, key: string) => (event: React.DragEvent) => {
    drag.current = state
    setDragKey(key)
    event.dataTransfer.effectAllowed = 'move'
    // Firefox nie zaczyna przeciągania bez danych.
    event.dataTransfer.setData('text/plain', key)
  }

  const onDragEnterCategory = (index: number) => (event: React.DragEvent) => {
    const state = drag.current
    if (!state || state.level !== 'category') return
    event.preventDefault()
    if (state.index === index) return
    moveCategory(state.index, index)
    drag.current = { level: 'category', index }
  }

  const onDragEnterSub = (parentId: string, index: number) => (event: React.DragEvent) => {
    const state = drag.current
    if (!state || state.level !== 'sub' || state.parentId !== parentId) return
    event.preventDefault()
    event.stopPropagation()
    if (state.index === index) return
    moveSub(parentId, state.index, index)
    drag.current = { level: 'sub', parentId, index }
  }

  const allowDrop = (event: React.DragEvent) => {
    if (drag.current) event.preventDefault()
  }

  const onDragEnd = () => {
    drag.current = null
    setDragKey(null)
  }

  return (
    <section className="flex flex-col gap-4 animate-fade-in">
      <Card className="flex flex-col">
        <CardHeader
          icon={ListTree}
          title="Menu sklepu"
          subtitle={`${categories.length} kategorii (${stats.hiddenCategories} ukrytych) · ${stats.subs} podkategorii (${stats.hiddenSubs} ukrytych)`}
          actions={
            <>
              <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 self-center text-xs font-medium text-text-2 hover:text-text">
                Zobacz sklep <ExternalLink size={12} strokeWidth={1.5} />
              </a>
              <Button size="sm" variant="ghost" onClick={() => setExpanded(allExpanded ? new Set() : new Set(categories.map((c) => c.id)))} disabled={!categories.length}>
                {allExpanded ? 'Zwiń wszystkie' : 'Rozwiń wszystkie'}
              </Button>
              <Button size="sm" variant="ghost" onClick={reset} disabled={!dirty || saving}>
                <RotateCcw size={14} strokeWidth={1.5} />
                Cofnij zmiany
              </Button>
              <Button size="sm" onClick={save} disabled={saving || !dirty}>
                <Save size={14} strokeWidth={1.5} />
                {saving ? 'Zapisuję…' : dirty ? 'Zapisz' : 'Zapisano'}
              </Button>
            </>
          }
        />

        <div className="grid gap-4 px-4 pt-3 pb-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <div className="flex min-w-0 flex-col gap-2">
            {!customized && (
              <NoticeBox className="border-primary/30 bg-primary/5">
                To obecna, domyślna kolejność menu. Przestaw pozycje i kliknij „Zapisz”, żeby ustalić własną.
              </NoticeBox>
            )}
            <p className="m-0 text-[11px] text-text-2">
              Przeciągnij za <GripVertical size={11} strokeWidth={1.5} className="inline align-[-1px]" /> albo użyj strzałek. Oko ukrywa pozycję w menu
              (komputer i telefon), w pigułkach na stronie kategorii i w kafelkach na stronie głównej — sama strona i produkty działają dalej pod swoim adresem.
            </p>

            {!categories.length && (
              <EmptyState icon={<ListTree size={20} strokeWidth={1.5} />} title="Brak kategorii">
                Kategorie zakłada się w Sanity Studio — po opublikowaniu pojawią się tutaj.
              </EmptyState>
            )}

            <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
              {categories.map((category, index) => {
                const open = expanded.has(category.id)
                const visibleSubs = category.subcategories.filter((s) => !s.hidden).length
                return (
                  <li
                    key={category.id}
                    onDragEnter={onDragEnterCategory(index)}
                    onDragOver={allowDrop}
                    className={cn(
                      'rounded-xs border bg-surface transition-colors',
                      dragKey === category.id ? 'border-primary/60 bg-primary/5' : 'border-border',
                    )}
                  >
                    <div className={cn('flex items-center gap-2 px-2 py-2', category.hidden && 'opacity-60')}>
                      <span
                        draggable
                        onDragStart={onDragStart({ level: 'category', index }, category.id)}
                        onDragEnd={onDragEnd}
                        className="grid size-7 shrink-0 cursor-grab place-items-center rounded-xs text-muted hover:bg-surface-muted active:cursor-grabbing"
                        title="Przeciągnij, żeby zmienić kolejność"
                        aria-hidden
                      >
                        <GripVertical size={14} strokeWidth={1.5} />
                      </span>
                      <span className="w-5 shrink-0 text-right font-mono text-[11px] text-text-2">{index + 1}.</span>
                      <button
                        type="button"
                        onClick={() => toggleExpanded(category.id)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                        aria-expanded={open}
                      >
                        {open ? <ChevronDown size={14} strokeWidth={1.5} className="shrink-0 text-text-2" /> : <ChevronRight size={14} strokeWidth={1.5} className="shrink-0 text-text-2" />}
                        <span className="min-w-0">
                          <strong className={cn('block truncate text-sm font-semibold text-text', category.hidden && 'line-through decoration-text-2/60')}>{category.title}</strong>
                          <span className="block truncate text-[11px] text-text-2">
                            {category.subcategories.length
                              ? `${visibleSubs} z ${category.subcategories.length} podkategorii w menu`
                              : 'bez podkategorii — w menu tylko „Wszystko z kategorii”'}
                            {` · ${category.productCount} produktów`}
                          </span>
                        </span>
                      </button>
                      {category.hidden && <Badge tone="danger">ukryta</Badge>}
                      <span className="flex shrink-0 items-center gap-0.5">
                        <IconButton label="W górę" className="size-7" disabled={index === 0} onClick={() => moveCategory(index, index - 1)}>
                          <ArrowUp size={13} strokeWidth={1.5} />
                        </IconButton>
                        <IconButton label="W dół" className="size-7" disabled={index === categories.length - 1} onClick={() => moveCategory(index, index + 1)}>
                          <ArrowDown size={13} strokeWidth={1.5} />
                        </IconButton>
                        <IconButton
                          label={category.hidden ? `Pokaż „${category.title}” w menu` : `Ukryj „${category.title}” w menu`}
                          className={cn('size-7', category.hidden && 'text-danger')}
                          onClick={() => toggleCategory(category.id)}
                        >
                          {category.hidden ? <EyeOff size={13} strokeWidth={1.5} /> : <Eye size={13} strokeWidth={1.5} />}
                        </IconButton>
                      </span>
                    </div>

                    {open && (
                      <div className="border-t border-border px-2 py-2 sm:pl-14">
                        {category.hidden && category.subcategories.length > 0 && (
                          <p className="m-0 mb-1.5 text-[11px] text-text-2">Kategoria jest ukryta — jej podkategorie też nie pokażą się w menu.</p>
                        )}
                        {category.subcategories.length ? (
                          <ol className="m-0 flex list-none flex-col gap-1 p-0">
                            {category.subcategories.map((sub, subIndex) => (
                              <SubRow
                                key={sub.id}
                                sub={sub}
                                index={subIndex}
                                count={category.subcategories.length}
                                parentHidden={category.hidden}
                                dragging={dragKey === sub.id}
                                onMove={(to) => moveSub(category.id, subIndex, to)}
                                onToggle={() => toggleSub(category.id, sub.id)}
                                onDragStart={onDragStart({ level: 'sub', parentId: category.id, index: subIndex }, sub.id)}
                                onDragEnter={onDragEnterSub(category.id, subIndex)}
                                onDragOver={allowDrop}
                                onDragEnd={onDragEnd}
                              />
                            ))}
                          </ol>
                        ) : (
                          <p className="m-0 text-[11px] text-text-2">Ta kategoria nie ma podkategorii.</p>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>

            {initial.orphans.length > 0 && (
              <NoticeBox>
                {initial.orphans.length === 1 ? 'Podkategoria' : `${initial.orphans.length} podkategorii`} bez kategorii nadrzędnej
                ({initial.orphans.slice(0, 5).map((o) => o.title).join(', ')}{initial.orphans.length > 5 ? '…' : ''}) nie pojawi się w menu — ustaw
                „Parent category” w Studio.
              </NoticeBox>
            )}
            {error && <ErrorBox>{error}</ErrorBox>}
          </div>

          <MenuPreview categories={categories} />
        </div>
      </Card>
    </section>
  )
}

/** Odtworzenie stanu z ostatniego zapisu (snapshot trzyma tylko id i ukrycie). */
function initialFromSaved(savedSnapshot: string, current: MenuEditorCategory[]): MenuEditorCategory[] {
  const layout = JSON.parse(savedSnapshot) as MenuLayoutInput
  const categories = new Map(current.map((c) => [c.id, c]))
  return layout.categories.flatMap((entry) => {
    const category = categories.get(entry.id)
    if (!category) return []
    const subs = new Map(category.subcategories.map((s) => [s.id, s]))
    return [{
      ...category,
      hidden: entry.hidden,
      subcategories: entry.subcategories.flatMap((subEntry) => {
        const sub = subs.get(subEntry.id)
        return sub ? [{ ...sub, hidden: subEntry.hidden }] : []
      }),
    }]
  })
}

function SubRow({
  sub,
  index,
  count,
  parentHidden,
  dragging,
  onMove,
  onToggle,
  onDragStart,
  onDragEnter,
  onDragOver,
  onDragEnd,
}: {
  sub: MenuEditorSubcategory
  index: number
  count: number
  parentHidden: boolean
  dragging: boolean
  onMove: (to: number) => void
  onToggle: () => void
  onDragStart: (event: React.DragEvent) => void
  onDragEnter: (event: React.DragEvent) => void
  onDragOver: (event: React.DragEvent) => void
  onDragEnd: () => void
}) {
  return (
    <li
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      className={cn(
        'flex items-center gap-2 rounded-xs border px-2 py-1.5 transition-colors',
        dragging ? 'border-primary/60 bg-primary/5' : 'border-border bg-bg',
        (sub.hidden || parentHidden) && 'opacity-60',
      )}
    >
      <span
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className="grid size-6 shrink-0 cursor-grab place-items-center rounded-xs text-muted hover:bg-surface-muted active:cursor-grabbing"
        title="Przeciągnij, żeby zmienić kolejność"
        aria-hidden
      >
        <GripVertical size={13} strokeWidth={1.5} />
      </span>
      <span className="w-5 shrink-0 text-right font-mono text-[11px] text-text-2">{index + 1}.</span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-xs font-medium text-text', sub.hidden && 'line-through decoration-text-2/60')}>{sub.title}</span>
        <span className="block truncate text-[11px] text-text-2">
          {sub.slug ? `/subcategory/${sub.slug}` : 'bez sluga'} · {sub.productCount} produktów
        </span>
      </span>
      {sub.hidden && <Badge tone="danger">ukryta</Badge>}
      {!sub.hidden && sub.productCount === 0 && <Badge tone="neutral">pusta</Badge>}
      {sub.slug && (
        <a href={`/subcategory/${sub.slug}`} target="_blank" rel="noopener noreferrer" className="hidden text-[11px] font-medium text-text-2 hover:text-text sm:inline">
          w sklepie ↗
        </a>
      )}
      <span className="flex shrink-0 items-center gap-0.5">
        <IconButton label="W górę" className="size-7" disabled={index === 0} onClick={() => onMove(index - 1)}>
          <ArrowUp size={13} strokeWidth={1.5} />
        </IconButton>
        <IconButton label="W dół" className="size-7" disabled={index === count - 1} onClick={() => onMove(index + 1)}>
          <ArrowDown size={13} strokeWidth={1.5} />
        </IconButton>
        <IconButton
          label={sub.hidden ? `Pokaż „${sub.title}” w menu` : `Ukryj „${sub.title}” w menu`}
          className={cn('size-7', sub.hidden && 'text-danger')}
          onClick={onToggle}
        >
          {sub.hidden ? <EyeOff size={13} strokeWidth={1.5} /> : <Eye size={13} strokeWidth={1.5} />}
        </IconButton>
      </span>
    </li>
  )
}

/** Podgląd: to, co zobaczy klient (tylko widoczne pozycje, w tej kolejności). */
function MenuPreview({ categories }: { categories: MenuEditorCategory[] }) {
  const visible = categories.filter((c) => !c.hidden)
  return (
    <aside className="flex min-w-0 flex-col gap-2 self-start rounded-xs border border-border bg-surface p-3 xl:sticky xl:top-4">
      <h3 className="m-0 text-xs font-semibold text-text">Podgląd menu w sklepie</h3>
      {visible.length ? (
        <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
          {visible.map((category) => {
            const subs = category.subcategories.filter((s) => !s.hidden)
            return (
              <li key={category.id} className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-text">{category.title}</span>
                <ul className="m-0 mt-1 flex list-none flex-col gap-0.5 border-l border-border p-0 pl-2.5">
                  <li className="truncate text-[11px] text-text-2">Wszystko z kategorii →</li>
                  {subs.map((sub) => (
                    <li key={sub.id} className="truncate text-xs text-text">{sub.title}</li>
                  ))}
                </ul>
              </li>
            )
          })}
          <li className="truncate text-[13px] font-semibold text-text-2">Poradniki <span className="font-normal">(stały link)</span></li>
        </ol>
      ) : (
        <p className="m-0 text-xs text-text-2">Wszystkie kategorie są ukryte — w menu zostanie tylko link „Poradniki”.</p>
      )}
    </aside>
  )
}
