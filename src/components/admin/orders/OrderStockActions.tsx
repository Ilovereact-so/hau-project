'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { PackageCheck, PackageMinus } from 'lucide-react'
import { adminDeductOrderStock, adminRestockOrder } from '@/actions/adminOrders'
import { Button } from '../kit/Button'
import { ErrorBox } from '../kit/EmptyState'

/** Przyciski karty „Magazyn” w szczegółach zamówienia. */
export function OrderStockActions({
  orderId,
  canRestock,
  canDeduct,
}: {
  orderId: string
  canRestock: boolean
  canDeduct: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  if (!canRestock && !canDeduct) return null

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setError('')
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) {
        const message = result.error ?? 'Operacja nie powiodła się.'
        setError(message)
        toast.error(message)
        return
      }
      toast.success(success)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <ErrorBox>{error}</ErrorBox>}
      {canRestock && (
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            if (!window.confirm('Towar z tego zamówienia wrócił i nadaje się do sprzedaży?\n\nZdjęte sztuki wrócą na stan w sklepie.')) return
            run(() => adminRestockOrder(orderId), 'Stan wrócił na magazyn')
          }}
        >
          <PackageCheck size={14} strokeWidth={1.5} />
          {pending ? 'Zapisuję…' : 'Towar wrócił na magazyn'}
        </Button>
      )}
      {canDeduct && (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => adminDeductOrderStock(orderId), 'Stan zdjęty')}>
          <PackageMinus size={14} strokeWidth={1.5} />
          {pending ? 'Zapisuję…' : 'Zdejmij stan teraz'}
        </Button>
      )}
    </div>
  )
}
