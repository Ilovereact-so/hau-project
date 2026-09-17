'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { AlertTriangle, Eye, Pencil, Plus, RefreshCw, Trash2, Truck, Warehouse } from 'lucide-react'
import type { AdminShippingMethod, ShippingType } from '@/lib/admin/catalog'
import {
  adminCreateShippingMethod,
  adminDeleteShippingMethod,
  adminPublishShippingMethod,
  adminSetShippingActive,
  adminSyncFurgonetkaServices,
  adminUpdateShippingMethod,
} from '@/actions/adminShipping'
import { PublishStateLabel, ShippingTypeLabel } from '@/lib/admin/labels'
import { Badge, PUBLISH_TONES, toneFor } from '../kit/Badge'
import { Button, IconButton } from '../kit/Button'
import { Card, CardHeader } from '../kit/Card'
import { DataTable, Td, Th, Tr } from '../kit/DataTable'
import { EmptyState, ErrorBox } from '../kit/EmptyState'
import { Modal } from '../kit/Modal'
import { PillButton } from '../kit/Pill'
import { SelectField, TextField } from '../kit/TextField'
import { Toggle } from '../kit/Toggle'
import { formatCurrencyPrecise, formatCentsPrecise } from '../kit/format'

export type FurgonetkaServiceRow = {
  id: string
  serviceCode: string
  name: string
  deliveryType: string
  priceCents: number
  isActive: boolean
}

export function ShippingView({
  methods,
  usage,
  services,
  loadError,
}: {
  methods: AdminShippingMethod[]
  usage: Record<string, number>
  services: FurgonetkaServiceRow[]
  loadError?: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState<AdminShippingMethod | 'new' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const act = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(key)
    setError('')
    const result = await fn()
    setBusy(null)
    if (!result.ok) {
      setError(result.error ?? 'Operacja nie powiodła się.')
      return
    }
    toast.success(success)
    startTransition(() => router.refresh())
  }

  const activeCount = methods.filter((method) => method.active === true && method.status !== 'draft').length
  const unset = methods.filter((method) => method.active === null)

  return (
    <section className="flex flex-col gap-4 animate-fade-in">
      <Card className="flex flex-col">
        <CardHeader
          icon={Truck}
          title="Metody dostawy w checkoucie"
          subtitle={`${methods.length} metod · ${activeCount} aktywnych. Źródło: dokumenty „Shipping Methods” w Sanity — to z nich checkout bierze listę i ceny.`}
          actions={
            <>
              <PillButton icon={RefreshCw} onClick={() => startTransition(() => router.refresh())}>
                Odśwież
              </PillButton>
              <Button size="sm" onClick={() => setEditing('new')}>
                <Plus size={14} strokeWidth={2} />
                Dodaj metodę
              </Button>
            </>
          }
        />
        <div className="px-4 pt-3 pb-4">
          {loadError && <ErrorBox className="mb-3">{loadError}</ErrorBox>}
          {error && <ErrorBox className="mb-3">{error}</ErrorBox>}
          {unset.length > 0 && (
            <div className="mb-3 flex items-start gap-2 rounded-xs border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] font-medium text-primary">
              <AlertTriangle size={14} strokeWidth={1.5} className="mt-px shrink-0" />
              <span>
                {unset.map((method) => method.name).join(', ')} — pole „aktywna” jest nieustawione. Checkout pokazywał takie metody, ale
                odrzucał zamówienie z nimi. Włącz lub wyłącz je jawnie przełącznikiem.
              </span>
            </div>
          )}

          {methods.length ? (
            <DataTable>
              <thead>
                <tr>
                  <Th>Metoda</Th>
                  <Th>Rodzaj</Th>
                  <Th>Kod Furgonetki</Th>
                  <Th className="text-right">Cena</Th>
                  <Th className="text-right">Zamówienia (30 dni)</Th>
                  <Th>Publikacja</Th>
                  <Th>Aktywna</Th>
                  <Th>Akcje</Th>
                </tr>
              </thead>
              <tbody>
                {methods.map((method) => (
                  <Tr key={method.id}>
                    <Td className="font-medium">{method.name}</Td>
                    <Td>{method.type ? ShippingTypeLabel[method.type] : <span className="text-danger">nieustawiony</span>}</Td>
                    <Td>
                      <code className="font-mono text-[11px]">{method.serviceId ?? '—'}</code>
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      {method.price !== null ? formatCurrencyPrecise(method.price) : <span className="text-danger">brak</span>}
                    </Td>
                    <Td className="text-right">{method.serviceId ? usage[method.serviceId] ?? 0 : 0}</Td>
                    <Td>
                      <Badge tone={toneFor(PUBLISH_TONES, method.status)}>{PublishStateLabel[method.status]}</Badge>
                    </Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        <Toggle
                          checked={method.active === true}
                          label={method.active ? 'Wyłącz metodę' : 'Włącz metodę'}
                          disabled={busy === `active-${method.id}`}
                          onChange={() =>
                            void act(
                              `active-${method.id}`,
                              () => adminSetShippingActive(method.id, method.active !== true),
                              method.active ? 'Metoda wyłączona' : 'Metoda włączona'
                            )
                          }
                        />
                        {method.active === null && <Badge tone="primary">nieustawione</Badge>}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex gap-1.5">
                        {method.status !== 'published' && (
                          <IconButton
                            label="Opublikuj"
                            disabled={busy === `publish-${method.id}`}
                            onClick={() => void act(`publish-${method.id}`, () => adminPublishShippingMethod(method.id), 'Opublikowano')}
                          >
                            <Eye size={14} strokeWidth={1.5} />
                          </IconButton>
                        )}
                        <IconButton label="Edytuj" onClick={() => setEditing(method)}>
                          <Pencil size={14} strokeWidth={1.5} />
                        </IconButton>
                        <IconButton
                          label="Usuń"
                          className="text-danger hover:border-danger/50 hover:text-danger"
                          disabled={busy === `delete-${method.id}`}
                          onClick={() => {
                            if (!window.confirm(`Usunąć metodę „${method.name}”? Zamówienia historyczne zachowają kod dostawy.`)) return
                            void act(`delete-${method.id}`, () => adminDeleteShippingMethod(method.id), 'Metoda usunięta')
                          }}
                        >
                          <Trash2 size={14} strokeWidth={1.5} />
                        </IconButton>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <EmptyState icon={<Truck size={20} strokeWidth={1.5} />} title="Brak metod dostawy">
              Bez żadnej aktywnej metody klient nie złoży zamówienia. Dodaj kuriera lub paczkomat.
            </EmptyState>
          )}
        </div>
      </Card>

      <Card className="flex flex-col">
        <CardHeader
          icon={Warehouse}
          title="Usługi na koncie Furgonetki"
          subtitle="Kopia listy usług z API Furgonetki — z niej wybierasz „kod Furgonetki” dla metody dostawy."
          actions={
            <Button
              size="sm"
              variant="secondary"
              disabled={busy === 'sync'}
              onClick={() =>
                void (async () => {
                  setBusy('sync')
                  setError('')
                  const result = await adminSyncFurgonetkaServices()
                  setBusy(null)
                  if (!result.ok) return setError(result.error)
                  toast.success(`Synchronizacja: ${result.data.added} nowych, ${result.data.existing} już znanych`)
                  startTransition(() => router.refresh())
                })()
              }
            >
              <RefreshCw size={14} strokeWidth={1.5} />
              {busy === 'sync' ? 'Synchronizuję…' : 'Synchronizuj z Furgonetką'}
            </Button>
          }
        />
        <div className="px-4 pt-3 pb-4">
          {services.length ? (
            <div className="flex flex-wrap gap-2">
              {services.map((service) => (
                <span key={service.id} className="inline-flex items-center gap-2 rounded-xs border border-border bg-surface px-2.5 py-1.5 text-xs">
                  <b className="font-medium text-text">{service.name}</b>
                  <code className="font-mono text-[11px] text-text-2">{service.serviceCode}</code>
                  {service.priceCents > 0 && <span className="text-text-2">{formatCentsPrecise(service.priceCents)}</span>}
                </span>
              ))}
            </div>
          ) : (
            <p className="m-0 text-xs text-text-2">
              Lista jest pusta — kliknij „Synchronizuj z Furgonetką” (wymaga autoryzacji konta w zakładce Integracje).
            </p>
          )}
        </div>
      </Card>

      {editing && (
        <ShippingModal
          method={editing === 'new' ? null : editing}
          services={services}
          onClose={() => setEditing(null)}
          onSaved={() => startTransition(() => router.refresh())}
        />
      )}
    </section>
  )
}

function ShippingModal({
  method,
  services,
  onClose,
  onSaved,
}: {
  method: AdminShippingMethod | null
  services: FurgonetkaServiceRow[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(method?.name ?? '')
  const [price, setPrice] = useState(method?.price !== null && method?.price !== undefined ? String(method.price) : '')
  const [serviceId, setServiceId] = useState(method?.serviceId ?? '')
  const [type, setType] = useState<ShippingType>(method?.type ?? 'kurier')
  const [active, setActive] = useState(method?.active ?? false)
  const [error, setError] = useState('')
  const [saving, startSaving] = useTransition()

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = Number(price.replace(',', '.'))
    if (price.trim() === '' || !Number.isFinite(value) || value < 0) {
      setError('Podaj cenę dostawy (0 = darmowa).')
      return
    }
    setError('')
    startSaving(async () => {
      const input = { name, price: value, serviceId, type, active }
      const result = method ? await adminUpdateShippingMethod(method.id, input) : await adminCreateShippingMethod(input)
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(method ? 'Metoda zapisana' : 'Metoda dodana')
      onSaved()
      onClose()
    })
  }

  return (
    <Modal
      as="form"
      onSubmit={submit}
      title={method ? `Edycja: ${method.name}` : 'Nowa metoda dostawy'}
      subtitle="Cena trafia do checkoutu i jest sprawdzana po stronie serwera przy składaniu zamówienia."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anuluj
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Zapisywanie…' : 'Zapisz'}
          </Button>
        </>
      }
    >
      <TextField label="Nazwa w checkoucie" required autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Cena (zł)" required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="np. 14,99" />
        <SelectField
          label="Rodzaj"
          value={type}
          onChange={(e) => setType(e.target.value as ShippingType)}
          options={[
            { value: 'kurier', label: 'Kurier (adres)' },
            { value: 'automat', label: 'Paczkomat / punkt odbioru' },
          ]}
        />
      </div>
      <TextField
        label="Kod usługi Furgonetki"
        required
        value={serviceId}
        onChange={(e) => setServiceId(e.target.value)}
        className="font-mono"
        list="furgonetka-services"
        hint="Np. inpost, dpd, dhl — musi odpowiadać usłudze na koncie Furgonetki (mapa punktów i nadawanie paczek)."
      />
      <datalist id="furgonetka-services">
        {services.map((service) => (
          <option key={service.id} value={service.serviceCode}>
            {service.name}
          </option>
        ))}
      </datalist>
      <label className="flex items-center gap-2 text-xs font-medium text-text-2">
        <Toggle checked={active} onChange={() => setActive((v) => !v)} label="Aktywna" />
        Aktywna — widoczna w checkoucie
      </label>
      {error && <ErrorBox>{error}</ErrorBox>}
    </Modal>
  )
}
