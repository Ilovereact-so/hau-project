'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import toast from 'react-hot-toast'
import { History, RefreshCw } from 'lucide-react'
import type { AdminProduct } from '@/lib/admin/catalog'
import type { AdminPriceHistory } from '@/lib/priceHistory'
import type { PriceChangeSource } from '@/db/schema'
import { adminGetPriceHistory, adminResyncPriceHistory } from '@/actions/adminProducts'
import { Badge } from '../kit/Badge'
import { IconButton } from '../kit/Button'
import { formatCurrencyPrecise, formatDateTime } from '../kit/format'
import { cn } from '../kit/utils'

const SOURCE_LABELS: Record<PriceChangeSource, string> = {
  init: 'pierwszy zapis',
  admin: 'panel',
  import: 'import CSV',
  webhook: 'Sanity Studio',
  cron: 'uzgodnienie',
  observed: 'wykryte w sklepie',
}

/**
 * Podgląd rejestru cen produktu: najniższa cena z 30 dni i obniżka dla
 * każdego wariantu oraz ostatnie zmiany. Tylko do odczytu — rejestr
 * zapisuje się sam przy każdej zmianie ceny.
 */
export function PriceHistoryPanel({ product }: { product: AdminProduct }) {
  const [data, setData] = useState<AdminPriceHistory | null>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const load = useCallback(async () => {
    const result = await adminGetPriceHistory(product.id)
    if (result.ok) {
      setData(result.data)
      setError('')
    } else {
      setError(result.error)
    }
  }, [product.id])

  useEffect(() => {
    void load()
  }, [load])

  const resync = () =>
    startTransition(async () => {
      const result = await adminResyncPriceHistory(product.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.data.changed ? 'Zarejestrowano zmianę ceny' : 'Rejestr jest aktualny')
      await load()
    })

  const labelFor = (key: string) => {
    if (!key) return product.variants.length ? 'Cena bazowa' : 'Produkt'
    return product.variants.find((variant) => variant.key === key)?.label || product.variants.find((v) => v.key === key)?.sku || `Wariant ${key}`
  }

  const keys = data ? Object.keys(data.omnibus).sort((a, b) => (a === '' ? -1 : b === '' ? 1 : labelFor(a).localeCompare(labelFor(b), 'pl'))) : []

  return (
    <div className="grid gap-2 rounded-xs border border-border bg-surface-muted px-3 py-2.5">
      <div className="flex items-center gap-2">
        <History size={14} strokeWidth={1.5} className="text-text-2" />
        <span className="text-xs font-medium text-text">Najniższa cena z 30 dni</span>
        <IconButton label="Uzgodnij z Sanity" className="ml-auto size-7" onClick={resync} disabled={pending}>
          <RefreshCw size={13} strokeWidth={1.5} className={cn(pending && 'animate-spin')} />
        </IconButton>
      </div>
      <p className="m-0 text-[11px] leading-[1.5] text-text-2">
        Liczona automatycznie z historii cen. Obniżka (cena przekreślona i procent w sklepie) pojawia się sama,
        gdy nowa cena jest niższa od najniższej ceny z 30 dni przed zmianą.
      </p>

      {error && <p className="m-0 text-[11px] text-danger">{error}</p>}
      {!data && !error && <p className="m-0 text-[11px] text-text-2">Wczytywanie…</p>}

      {data && product.status === 'draft' && !keys.length && (
        <p className="m-0 text-[11px] text-text-2">Szkic — ceny trafią do rejestru po publikacji.</p>
      )}
      {data && product.status !== 'draft' && !keys.length && (
        <p className="m-0 text-[11px] text-text-2">Brak wpisów. Użyj przycisku odświeżania, aby zarejestrować bieżące ceny.</p>
      )}

      {keys.length > 0 && data && (
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="text-text-2">
              <th className="py-1 pr-2 text-left font-medium">Cena</th>
              <th className="py-1 pr-2 text-right font-medium">Teraz</th>
              <th className="py-1 pr-2 text-right font-medium">Najniższa 30 dni</th>
              <th className="py-1 text-right font-medium">Obniżka</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => {
              const info = data.omnibus[key]
              return (
                <tr key={key || 'base'} className="border-t border-border">
                  <td className="py-1 pr-2 text-text">{labelFor(key)}</td>
                  <td className="py-1 pr-2 text-right font-medium tabular-nums">{formatCurrencyPrecise(info.price)}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">
                    {formatCurrencyPrecise(info.promo ? info.promo.referencePrice : info.lowest30d)}
                    {info.promo && <span className="block text-[10px] text-text-2">przed obniżką</span>}
                  </td>
                  <td className="py-1 text-right">
                    {info.promo ? <Badge tone="success">-{info.promo.percent}%</Badge> : <span className="text-text-2">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {data && data.entries.length > 0 && (
        <details className="text-[11px]">
          <summary className="cursor-pointer text-text-2 hover:text-text">Historia zmian ({data.entries.length})</summary>
          <ul className="m-0 mt-1.5 grid max-h-48 list-none gap-1 overflow-auto p-0">
            {data.entries.map((entry, index) => (
              <li key={`${entry.variantKey}-${entry.validFrom}-${index}`} className="flex flex-wrap items-baseline gap-x-2">
                <span className="tabular-nums text-text-2">{formatDateTime(entry.validFrom)}</span>
                <span className="text-text">{labelFor(entry.variantKey)}</span>
                <span className="font-medium tabular-nums">{formatCurrencyPrecise(entry.price)}</span>
                <span className="text-text-2">
                  {SOURCE_LABELS[entry.source] ?? entry.source}
                  {entry.validTo ? ` · do ${formatDateTime(entry.validTo)}` : ' · obowiązuje'}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
