'use client'

import { useState, useTransition } from 'react'
import toast from 'react-hot-toast'
import { Download, FileSpreadsheet } from 'lucide-react'
import { adminExportOrdersCsv } from '@/actions/adminExport'
import { Button } from './kit/Button'
import { Card, CardHeader } from './kit/Card'
import { ErrorBox } from './kit/EmptyState'
import { PillButton, PillDate } from './kit/Pill'

/** Zapis tekstu jako pliku CSV (z BOM, żeby Excel poprawnie czytał polskie znaki). */
export function downloadCsv(csv: string, fileName: string) {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const iso = (date: Date) => date.toISOString().slice(0, 10)

/** Eksport zamówień do CSV dla księgowości — dowolny zakres dat. */
export default function ExportOrdersCsv() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const preset = (days: number | 'month' | 'prev') => {
    const now = new Date()
    if (days === 'month') {
      setFrom(iso(new Date(now.getFullYear(), now.getMonth(), 1)))
      setTo(iso(now))
    } else if (days === 'prev') {
      setFrom(iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)))
      setTo(iso(new Date(now.getFullYear(), now.getMonth(), 0)))
    } else {
      setFrom(iso(new Date(now.getTime() - days * 86400_000)))
      setTo(iso(now))
    }
  }

  const run = () =>
    startTransition(async () => {
      setError('')
      try {
        const res = await adminExportOrdersCsv(from || undefined, to || undefined)
        if (!res.count) {
          toast.error('Brak zamówień w tym zakresie')
          return
        }
        downloadCsv(res.csv, res.fileName)
        toast.success(`Eksport: ${res.count} wierszy`)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Nie udało się wygenerować pliku.')
      }
    })

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={FileSpreadsheet}
        title="Eksport zamówień do CSV"
        subtitle="Jeden wiersz = jedna pozycja zamówienia (zamówienie z 2 produktami da 2 wiersze). Plik otworzysz w Excelu albo Arkuszach Google."
      />
      <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <PillDate label="Od" value={from} onChange={setFrom} />
          <PillDate label="Do" value={to} onChange={setTo} />
          <PillButton onClick={() => preset(7)}>7 dni</PillButton>
          <PillButton onClick={() => preset(30)}>30 dni</PillButton>
          <PillButton onClick={() => preset('month')}>Ten miesiąc</PillButton>
          <PillButton onClick={() => preset('prev')}>Poprzedni miesiąc</PillButton>
          {(from || to) && (
            <PillButton onClick={() => { setFrom(''); setTo('') }}>Cały okres</PillButton>
          )}
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
        <div>
          <Button onClick={run} disabled={pending}>
            <Download size={15} strokeWidth={1.5} />
            {pending ? 'Generuję…' : 'Pobierz CSV'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
