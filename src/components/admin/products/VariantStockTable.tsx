'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Check } from 'lucide-react'
import type { AdminProduct } from '@/lib/admin/catalog'
import { adminUpdateVariantPrice, adminUpdateVariantStock } from '@/actions/adminProducts'
import { Button } from '../kit/Button'
import { CellInput } from '../kit/TextField'
import { formatCurrencyPrecise } from '../kit/format'
import { cn } from '../kit/utils'

type Row = { key: string | null; label: string; sku: string | null; stock: number | null; price: number | null }

/**
 * Rozwinięcie wiersza produktu: stany (i ceny) wariantów z zapisem w Sanity.
 * Wpisana liczba USTAWIA stan — nie dodaje (stara wersja panelu robiła `inc`).
 */
export function VariantStockTable({
  product,
  threshold,
  onError,
}: {
  product: AdminProduct
  threshold: number
  onError: (message: string) => void
}) {
  const rows: Row[] = product.variants.length
    ? product.variants.map((variant) => ({ ...variant }))
    : [{ key: null, label: 'Produkt (bez wariantów)', sku: product.sku, stock: product.stock, price: null }]

  return (
    <div className="px-3 py-3">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr className="text-text-2">
            <th className="border-y border-r border-border px-3 py-2 text-left text-[11px] font-medium">Wariant</th>
            <th className="border-y border-r border-border px-3 py-2 text-left text-[11px] font-medium">SKU</th>
            <th className="border-y border-r border-border px-3 py-2 text-left text-[11px] font-medium">Cena</th>
            <th className="border-y border-border px-3 py-2 text-left text-[11px] font-medium">Stan magazynowy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <VariantRow key={row.key ?? 'base'} productId={product.id} row={row} basePrice={product.price} threshold={threshold} onError={onError} />
          ))}
        </tbody>
      </table>
      {product.status === 'changed' && (
        <p className="mt-2 mb-0 text-[11px] text-text-2">
          Produkt ma niezapisane zmiany w Studio — zapis trafia i do wersji w sklepie, i do szkicu.
        </p>
      )}
    </div>
  )
}

function VariantRow({
  productId,
  row,
  basePrice,
  threshold,
  onError,
}: {
  productId: string
  row: Row
  basePrice: number | null
  threshold: number
  onError: (message: string) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [stock, setStock] = useState(row.stock === null ? '' : String(row.stock))
  const [price, setPrice] = useState(row.price === null ? '' : String(row.price))
  const stockDirty = stock !== (row.stock === null ? '' : String(row.stock))
  const priceDirty = row.key !== null && price !== (row.price === null ? '' : String(row.price))
  const low = row.stock !== null && row.stock < threshold

  const save = () =>
    startTransition(async () => {
      if (stockDirty) {
        const value = Number(stock)
        if (!Number.isInteger(value) || value < 0) {
          onError('Stan magazynowy musi być liczbą całkowitą ≥ 0.')
          return
        }
        const result = await adminUpdateVariantStock(productId, row.key, value)
        if (!result.ok) {
          onError(result.error)
          return
        }
      }
      if (priceDirty && row.key) {
        const value = price.trim() === '' ? null : Number(price.replace(',', '.'))
        if (value !== null && (!Number.isFinite(value) || value <= 0)) {
          onError('Cena wariantu musi być większa od 0 (albo pusta = cena produktu).')
          return
        }
        const result = await adminUpdateVariantPrice(productId, row.key, value)
        if (!result.ok) {
          onError(result.error)
          return
        }
      }
      toast.success('Zapisano w Sanity')
      router.refresh()
    })

  return (
    <tr className="align-middle">
      <td className="border-b border-border px-3 py-2">
        <span className="flex items-center gap-2">
          <i className={cn('inline-block size-1.5 shrink-0 rounded-full', low ? 'bg-danger' : 'bg-success')} aria-hidden />
          <span className="text-text">{row.label}</span>
        </span>
      </td>
      <td className="border-b border-border px-3 py-2">
        <code className="font-mono text-[11px] text-text-2">{row.sku ?? '—'}</code>
      </td>
      <td className="border-b border-border px-3 py-2">
        {row.key ? (
          <CellInput
            inputMode="decimal"
            value={price}
            placeholder={basePrice !== null ? formatCurrencyPrecise(basePrice) : 'cena produktu'}
            onChange={(event) => setPrice(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && (stockDirty || priceDirty) && save()}
            className="w-28"
            aria-label={`Cena: ${row.label}`}
          />
        ) : (
          <span className="text-text-2">{basePrice !== null ? formatCurrencyPrecise(basePrice) : '—'}</span>
        )}
      </td>
      <td className="border-b border-border px-3 py-2">
        <span className="flex items-center gap-2">
          <CellInput
            type="number"
            min="0"
            step="1"
            value={stock}
            placeholder="—"
            onChange={(event) => setStock(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && (stockDirty || priceDirty) && save()}
            className={cn('w-24', low && !stockDirty && 'border-danger/40 text-danger')}
            aria-label={`Stan: ${row.label}`}
          />
          <span className="text-[11px] text-text-2">szt.</span>
          {(stockDirty || priceDirty) && (
            <Button size="sm" variant="secondary" disabled={pending || (stockDirty && stock === '')} onClick={save}>
              <Check size={13} strokeWidth={2} />
              {pending ? 'Zapisuję…' : 'Zapisz'}
            </Button>
          )}
        </span>
      </td>
    </tr>
  )
}
