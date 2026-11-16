'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import type { ImportRowResult } from '@/lib/admin/productImport'
import { Badge } from '../kit/Badge'
import { Button } from '../kit/Button'
import { NoticeBox } from '../kit/EmptyState'
import { PillButton } from '../kit/Pill'
import { cn } from '../kit/utils'

/*
 * Krok „Sprawdź” importu CSV: co ZROBI import z każdym produktem — wynik
 * suchego przebiegu tej samej funkcji, która potem zapisuje
 * (lib/admin/productImport.ts → `diff`). Nowe produkty, zmienione pola
 * „przed → po”, wyczyszczone pola i usuwane warianty (wyróżnione), stany
 * i ceny wariantów oraz ostrzeżenia.
 */

export type CheckedRow = ImportRowResult & { error?: string }

type Filter = 'all' | 'changed' | 'destructive' | 'warnings' | 'created' | 'unchanged' | 'failed'

const PAGE = 60

export function summarizeChanges(rows: CheckedRow[]) {
  return {
    created: rows.filter((r) => r.ok && r.action === 'create').length,
    changed: rows.filter((r) => r.ok && r.action === 'update' && !r.diff?.unchanged).length,
    unchanged: rows.filter((r) => r.ok && r.diff?.unchanged).length,
    destructive: rows.filter((r) => r.ok && r.diff?.destructive).length,
    warnings: rows.filter((r) => r.diff?.warnings.length).length,
    failed: rows.filter((r) => !r.ok).length,
  }
}

export function ImportChangesPreview({ rows }: { rows: CheckedRow[] }) {
  const [filter, setFilter] = useState<Filter>('changed')
  const [limit, setLimit] = useState(PAGE)
  const stats = useMemo(() => summarizeChanges(rows), [rows])
  const visible = useMemo(() => {
    const list = rows.filter((r) => {
      if (filter === 'all') return true
      if (filter === 'failed') return !r.ok
      if (filter === 'created') return r.ok && r.action === 'create'
      if (filter === 'unchanged') return r.ok && r.diff?.unchanged
      if (filter === 'destructive') return r.ok && r.diff?.destructive
      if (filter === 'warnings') return Boolean(r.diff?.warnings.length)
      return r.ok && r.action === 'update' && !r.diff?.unchanged
    })
    // Najpierw to, co wymaga uwagi: błędy, potem usuwanie danych.
    const weight = (r: CheckedRow) => (!r.ok ? 0 : r.diff?.destructive ? 1 : 2)
    return list.sort((a, b) => weight(a) - weight(b) || a.row - b.row)
  }, [rows, filter])

  const pills: Array<[Filter, string, number]> = [
    ['changed', 'Zmienione', stats.changed],
    ['destructive', 'Usuwa dane', stats.destructive],
    ['warnings', 'Ostrzeżenia', stats.warnings],
    ['created', 'Nowe', stats.created],
    ['unchanged', 'Bez zmian', stats.unchanged],
    ['failed', 'Błędy', stats.failed],
    ['all', 'Wszystkie', rows.length],
  ]

  return (
    <div className="flex flex-col gap-2">
      <NoticeBox className={stats.destructive || stats.failed ? 'border-danger/30 bg-danger/5' : 'border-success/30 bg-success/5'}>
        <strong className="text-text">
          Co zrobi import: {stats.created} nowych · {stats.changed} zmienionych · {stats.unchanged} bez zmian
          {stats.failed ? ` · ${stats.failed} z błędem` : ''}
        </strong>
        <p className="mt-1 mb-0">
          Plik nadpisuje produkty o tym samym SKU: każda kolumna z pliku zastępuje dane w sklepie — także pusta komórka, która czyści pole.
          Kolumn, których w pliku nie ma, import nie rusza. Nazwa, cena i adres strony nie są czyszczone pustą komórką.
        </p>
        {stats.destructive > 0 && (
          <p className="mt-1 mb-0 text-danger">
            <AlertTriangle size={12} strokeWidth={2} className="mr-1 inline align-[-1px]" />
            {stats.destructive} produktów straci dane (wyczyszczone pola albo usunięte warianty) — sprawdź je w „Usuwa dane”.
          </p>
        )}
      </NoticeBox>

      <div className="flex flex-wrap gap-1.5">
        {pills.map(([key, label, count]) => (
          <PillButton key={key} active={filter === key} onClick={() => { setFilter(key); setLimit(PAGE) }} disabled={!count && key !== filter}>
            {label} <span className="text-text-2">{count}</span>
          </PillButton>
        ))}
      </div>

      {visible.length ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {visible.slice(0, limit).map((row) => <ChangeRow key={`${row.row}-${row.sku}`} row={row} />)}
        </ul>
      ) : (
        <p className="m-0 text-xs text-text-2">Brak produktów w tej grupie.</p>
      )}
      {visible.length > limit && (
        <Button size="sm" variant="ghost" onClick={() => setLimit((current) => current + PAGE)}>
          Pokaż kolejne ({visible.length - limit})
        </Button>
      )}
    </div>
  )
}

function ChangeRow({ row }: { row: CheckedRow }) {
  const [open, setOpen] = useState(false)
  const diff = row.diff
  const changes = (diff?.fields.length ?? 0) + (diff?.variants ? 1 : 0)
  return (
    <li className={cn('rounded-xs border bg-surface', !row.ok ? 'border-danger/50' : diff?.destructive ? 'border-danger/30' : 'border-border')}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left" aria-expanded={open}>
        {open ? <ChevronDown size={13} strokeWidth={1.5} className="shrink-0 text-text-2" /> : <ChevronRight size={13} strokeWidth={1.5} className="shrink-0 text-text-2" />}
        <span className="w-10 shrink-0 text-[11px] text-text-2">{row.row}</span>
        <code className="shrink-0 font-mono text-[11px]">{row.sku || '—'}</code>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-text">{row.title}</span>
        <span className="flex shrink-0 flex-wrap justify-end gap-1">
          {!row.ok && <Badge tone="danger">błąd</Badge>}
          {row.ok && row.action === 'create' && <Badge tone="success">nowy</Badge>}
          {row.ok && row.action === 'update' && (diff?.unchanged ? <Badge tone="neutral">bez zmian</Badge> : <Badge tone="info">{`${changes} zmian`}</Badge>)}
          {diff?.destructive && <Badge tone="danger">usuwa dane</Badge>}
          {diff?.variants?.removed.length ? <Badge tone="danger">{`−${diff.variants.removed.length} wariantów`}</Badge> : null}
          {diff?.warnings.length ? <Badge tone="primary">{`${diff.warnings.length} ostrzeżeń`}</Badge> : null}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-border px-2.5 py-2 text-[11px]">
          {row.error && <p className="m-0 text-danger">{row.error}</p>}
          {diff && diff.fields.length > 0 && (
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-text-2">
                  <th className="py-0.5 pr-2 font-medium">Pole</th>
                  {row.action !== 'create' && <th className="py-0.5 pr-2 font-medium">Teraz w sklepie</th>}
                  <th className="py-0.5 font-medium">{row.action === 'create' ? 'Wartość' : 'Po imporcie'}</th>
                </tr>
              </thead>
              <tbody>
                {diff.fields.map((change) => (
                  <tr key={change.field} className="border-t border-border align-top">
                    <td className="py-1 pr-2 whitespace-nowrap text-text-2">{change.label}</td>
                    {row.action !== 'create' && <td className="py-1 pr-2 text-text-2">{change.before || <span className="italic">puste</span>}</td>}
                    <td className={cn('py-1', change.kind === 'cleared' ? 'font-medium text-danger' : 'text-text')}>
                      {change.after || 'wyczyszczone'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {diff?.variants && (
            <div className="flex flex-col gap-1">
              <strong className="text-text">
                Warianty: {diff.variants.total} po imporcie
                {row.action === 'update' ? ` (zachowane ${diff.variants.kept}, nowe ${diff.variants.added.length}, usunięte ${diff.variants.removed.length})` : ''}
              </strong>
              {diff.variants.removed.length > 0 && (
                <p className="m-0 text-danger">Usunięte: {diff.variants.removed.join(' · ')}</p>
              )}
              {diff.variants.added.length > 0 && row.action === 'update' && <p className="m-0 text-text">Nowe: {diff.variants.added.join(' · ')}</p>}
              {diff.variants.values.length > 0 && (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-left text-text-2">
                      <th className="py-0.5 pr-2 font-medium">Wariant</th>
                      <th className="py-0.5 pr-2 font-medium">Stan</th>
                      <th className="py-0.5 font-medium">Cena</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diff.variants.values.map((value) => (
                      <tr key={value.label} className="border-t border-border">
                        <td className="py-1 pr-2 text-text">{value.label}</td>
                        <td className="py-1 pr-2">
                          {value.stockBefore === 'nowy' ? value.stockAfter : value.stockBefore === value.stockAfter ? value.stockAfter : `${value.stockBefore} → ${value.stockAfter}`}
                        </td>
                        <td className="py-1">
                          {value.priceBefore === 'nowy' ? value.priceAfter : value.priceBefore === value.priceAfter ? value.priceAfter : `${value.priceBefore} → ${value.priceAfter}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {diff?.warnings.length ? (
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-primary">
              {diff.warnings.map((warning, index) => (
                <li key={index}>⚠ {warning}</li>
              ))}
            </ul>
          ) : null}
          {diff?.unchanged && <p className="m-0 text-text-2">Dane w pliku są takie same jak w sklepie — import pominie ten produkt.</p>}
        </div>
      )}
    </li>
  )
}
