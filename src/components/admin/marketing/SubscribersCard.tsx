'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Download, UsersRound } from 'lucide-react'
import { adminExportSubscribersCsv, adminSetSubscriberActive } from '@/actions/adminMarketing'
import { Badge } from '../kit/Badge'
import { Button } from '../kit/Button'
import { Card, CardHeader } from '../kit/Card'
import { DataTable, Td, Th, Tr } from '../kit/DataTable'
import { ErrorBox } from '../kit/EmptyState'
import { PillSearch } from '../kit/Pill'
import { formatDateTime } from '../kit/format'
import { downloadCsv } from '../ExportOrdersCsv'

type Subscriber = { id: string; email: string; isActive: boolean; createdAt: Date | null }

export function SubscribersCard({ subscribers }: { subscribers: Subscriber[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const rows = search.trim()
    ? subscribers.filter((row) => row.email.toLowerCase().includes(search.trim().toLowerCase()))
    : subscribers

  const exportCsv = () =>
    startTransition(async () => {
      setError('')
      const result = await adminExportSubscribersCsv()
      if (!result.ok) return setError(result.error)
      if (!result.data.count) return void toast.error('Brak aktywnych subskrybentów')
      downloadCsv(result.data.csv, result.data.fileName)
      toast.success(`Wyeksportowano ${result.data.count} adresów`)
    })

  const toggle = (row: Subscriber) => {
    const message = row.isActive
      ? `Wypisać ${row.email} z newslettera? Zapis zgody zostanie w historii.`
      : `Przywrócić subskrypcję ${row.email}? Rób to tylko na wyraźną prośbę tej osoby (RODO).`
    if (!window.confirm(message)) return
    startTransition(async () => {
      const result = await adminSetSubscriberActive(row.id, !row.isActive)
      if (!result.ok) return setError(result.error)
      toast.success(row.isActive ? 'Wypisano z newslettera' : 'Subskrypcja przywrócona')
      router.refresh()
    })
  }

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={UsersRound}
        title="Subskrybenci"
        subtitle="Ostatnie 50 zapisów. Eksport obejmuje wszystkich aktywnych."
        actions={
          <>
            <PillSearch value={search} onChange={setSearch} placeholder="Szukaj adresu…" />
            <Button size="sm" variant="secondary" onClick={exportCsv} disabled={pending}>
              <Download size={14} strokeWidth={1.5} />
              Eksport CSV
            </Button>
          </>
        }
      />
      <div className="px-4 pt-3 pb-4">
        {error && <ErrorBox className="mb-3">{error}</ErrorBox>}
        {rows.length ? (
          <DataTable>
            <thead>
              <tr>
                <Th>E-mail</Th>
                <Th>Status</Th>
                <Th>Zapis</Th>
                <Th>Akcja</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium">{row.email}</Td>
                  <Td>
                    <Badge tone={row.isActive ? 'success' : 'neutral'}>{row.isActive ? 'Aktywny' : 'Wypisany'}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-text-2">{formatDateTime(row.createdAt)}</Td>
                  <Td>
                    <Button size="sm" variant={row.isActive ? 'danger' : 'ghost'} disabled={pending} onClick={() => toggle(row)}>
                      {row.isActive ? 'Wypisz' : 'Przywróć'}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <p className="m-0 text-xs text-text-2">{subscribers.length ? 'Brak adresów pasujących do wyszukiwania.' : 'Nikt jeszcze nie zapisał się do newslettera.'}</p>
        )}
      </div>
    </Card>
  )
}
