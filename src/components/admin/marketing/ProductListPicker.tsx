'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ImageOff, Search, X } from 'lucide-react'
import type { PickerProduct } from '@/lib/admin/homeLayout'
import { Badge } from '../kit/Badge'
import { IconButton } from '../kit/Button'

/*
 * Wybór produktów z wyszukiwarką (nazwa / SKU) — karuzele strony głównej
 * i kampanie newslettera.
 */

// ─── wybór produktów ──────────────────────────────────────────────────────────

export function ProductListPicker({
  label,
  hint,
  icon,
  ids,
  products,
  sortable,
  onChange,
}: {
  label: string
  hint?: string
  icon?: React.ReactNode
  ids: string[]
  products: PickerProduct[]
  sortable?: boolean
  onChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const needle = query.trim().toLowerCase()
  const results = needle
    ? products.filter((p) => !ids.includes(p.id) && `${p.title} ${p.sku ?? ''}`.toLowerCase().includes(needle)).slice(0, 8)
    : []

  const move = (index: number, delta: number) => {
    const next = [...ids]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="grid gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-text-2">
        {icon}
        {label} {ids.length > 0 && <span className="text-muted">({ids.length})</span>}
      </span>
      {ids.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {ids.map((id, index) => {
            const product = byId.get(id)
            return (
              <li key={id} className="flex items-center gap-2 rounded-xs border border-border bg-surface px-2 py-1">
                <Thumb url={product?.imageUrl ?? null} />
                <span className="min-w-0 flex-1 truncate text-xs text-text">
                  {product?.title ?? <span className="text-danger">Produkt usunięty ({id})</span>}
                  {product?.status === 'draft' && <span className="ml-1.5 text-[10px] text-danger">szkic — nie pojawi się</span>}
                </span>
                {sortable && (
                  <>
                    <IconButton label="W górę" className="size-6" disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowUp size={12} strokeWidth={1.5} />
                    </IconButton>
                    <IconButton label="W dół" className="size-6" disabled={index === ids.length - 1} onClick={() => move(index, 1)}>
                      <ArrowDown size={12} strokeWidth={1.5} />
                    </IconButton>
                  </>
                )}
                <IconButton label="Usuń z listy" className="size-6" onClick={() => onChange(ids.filter((x) => x !== id))}>
                  <X size={12} strokeWidth={1.5} />
                </IconButton>
              </li>
            )
          })}
        </ul>
      )}
      <div className="relative">
        <Search size={13} strokeWidth={1.5} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj produktu po nazwie lub SKU, aby dodać…"
          className="h-9 w-full rounded-xs border border-border bg-surface pr-3 pl-8 text-xs text-text outline-none focus:border-border-strong"
        />
        {results.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-20 m-0 mt-1 list-none overflow-hidden rounded-xs border border-border bg-surface p-1 shadow-2">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange([...ids, p.id])
                    setQuery('')
                  }}
                  className="flex w-full items-center gap-2 rounded-xs px-2 py-1.5 text-left text-xs hover:bg-surface-muted"
                >
                  <Thumb url={p.imageUrl} />
                  <span className="min-w-0 flex-1 truncate">
                    {p.title} {p.sku && <span className="text-text-2">· {p.sku}</span>}
                  </span>
                  {p.status === 'draft' && <Badge tone="neutral">szkic</Badge>}
                  {p.isFeatured && <Badge tone="primary">promowany</Badge>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {hint && <span className="text-[11px] text-text-2">{hint}</span>}
    </div>
  )
}

export function Thumb({ url }: { url: string | null }) {
  return (
    <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-xs border border-border bg-surface-muted text-muted">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url.includes('?') ? url : `${url}?w=56&h=56&fit=crop`} alt="" className="size-full object-cover" />
      ) : (
        <ImageOff size={12} strokeWidth={1.5} />
      )}
    </span>
  )
}

// ─── podgląd ──────────────────────────────────────────────────────────────────
