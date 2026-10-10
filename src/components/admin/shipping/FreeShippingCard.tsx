'use client'

import { useState, useTransition } from 'react'
import toast from 'react-hot-toast'
import { Gift, Save } from 'lucide-react'
import { adminSaveShopSettings } from '@/actions/adminShipping'
import type { AdminShopSettings } from '@/lib/admin/catalog'
import { Button } from '../kit/Button'
import { Card, CardHeader } from '../kit/Card'
import { ErrorBox } from '../kit/EmptyState'
import { TextField } from '../kit/TextField'
import { Toggle } from '../kit/Toggle'

/**
 * Darmowa dostawa od kwoty. Liczona od wartości produktów (przed kodem
 * rabatowym) — tak samo w koszyku (pasek „Brakuje X zł”), mini koszyku
 * i w kasie, która zeruje koszt dostawy w zamówieniu.
 */
export function FreeShippingCard({ initial }: { initial: AdminShopSettings }) {
  const [enabled, setEnabled] = useState(initial.freeShippingEnabled)
  const [threshold, setThreshold] = useState(initial.freeShippingThreshold !== null ? String(initial.freeShippingThreshold).replace('.', ',') : '')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const save = () => {
    const text = threshold.trim().replace(',', '.')
    const value = text ? Number(text) : null
    if (enabled && (value === null || !Number.isFinite(value) || value <= 0)) {
      setError('Podaj próg w zł (np. 199).')
      return
    }
    setError('')
    startTransition(async () => {
      const result = await adminSaveShopSettings({ freeShippingEnabled: enabled, freeShippingThreshold: value })
      if (!result.ok) return setError(result.error)
      toast.success(enabled ? `Darmowa dostawa od ${text.replace('.', ',')} zł` : 'Darmowa dostawa wyłączona')
    })
  }

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={Gift}
        title="Darmowa dostawa od kwoty"
        subtitle="Liczona od wartości produktów (przed kodem rabatowym). Koszyk i mini koszyk pokazują pasek „Brakuje X zł do darmowej dostawy”."
      />
      <div className="flex flex-wrap items-end gap-4 px-4 pt-3 pb-4">
        <label className="flex items-center gap-2 pb-2 text-xs font-medium text-text-2">
          <Toggle checked={enabled} onChange={() => setEnabled((v) => !v)} label="Darmowa dostawa od kwoty" />
          {enabled ? 'Włączona' : 'Wyłączona'}
        </label>
        <div className="w-[180px]">
          <TextField label="Próg (zł)" inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="np. 199" />
        </div>
        <Button size="sm" onClick={save} disabled={pending}>
          <Save size={14} strokeWidth={1.5} />
          {pending ? 'Zapisywanie…' : 'Zapisz'}
        </Button>
        {error && <ErrorBox className="w-full">{error}</ErrorBox>}
      </div>
    </Card>
  )
}
