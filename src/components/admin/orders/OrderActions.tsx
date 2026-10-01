'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  Ban, CheckCircle2, FileDown, Hammer, PackagePlus, RefreshCw, RotateCcw, Tag, Truck,
} from 'lucide-react'
import {
  adminCreateShipment,
  adminOrderShipment,
  adminRefreshShipment,
  adminRegisterShipment,
  adminSetShipmentStatus,
  adminUpdateOrderStatus,
} from '@/actions/adminOrders'
import type { OrderStatus, ShipmentStatus } from '@/db/schema'
import { ORDER_TRANSITIONS, ShipmentStatusLabel } from '@/lib/admin/labels'
import { Button } from '../kit/Button'
import { ErrorBox } from '../kit/EmptyState'
import { CellInput } from '../kit/TextField'
import { PillSelect } from '../kit/Pill'
import { cn } from '../kit/utils'

type ActionMeta = { label: string; icon: typeof Hammer; confirm?: string; variant?: 'secondary' | 'ghost' | 'danger' }

/** Podpisy przycisków — ten sam czasownik, którego oczekuje `ORDER_TRANSITIONS`. */
const STATUS_ACTIONS: Partial<Record<OrderStatus, ActionMeta>> = {
  processing: { label: 'Przyjmij do realizacji', icon: Hammer },
  shipped: { label: 'Oznacz jako wysłane', icon: Truck },
  delivered: { label: 'Potwierdź doręczenie', icon: CheckCircle2 },
  cancelled: {
    label: 'Anuluj zamówienie',
    icon: Ban,
    variant: 'danger',
    confirm: 'Anulować to zamówienie? Tej operacji nie da się cofnąć.\n\nJeśli klient zapłacił online, zwrot zlecasz osobno w panelu operatora płatności.',
  },
  refunded: {
    label: 'Oznacz jako zwrócone',
    icon: RotateCcw,
    variant: 'danger',
    confirm: 'Oznaczyć zamówienie jako zwrócone?\n\nTo zmienia wyłącznie status w sklepie — przelew zwrotny zlecasz w panelu Autopay / Przelewy24.',
  },
}

type Shipment = {
  id: string
  furgonetkaId: string | null
  trackingNumber: string | null
  carrier: string
  service: string
  status: string
  labelUrl: string | null
  parcelWeightG: number
} | null

const DEFAULT_PARCEL = { weightKg: 2, widthCm: 30, heightCm: 15, depthCm: 20 }

export function OrderActions({
  orderId,
  status,
  shipment,
  shippingMethod,
  isPickupPoint,
}: {
  orderId: string
  status: string
  shipment: Shipment
  shippingMethod: string
  isPickupPoint: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Przesyłka z Furgonetki: „wysłane” i „doręczone” ustawia Furgonetka (webhook /
  // „Odśwież status”), nie admin — ręcznie zostaje tylko anulowanie i zwrot.
  const autoTracked = Boolean(shipment?.furgonetkaId)
  const allowed = useMemo(
    () => (ORDER_TRANSITIONS[status] ?? []).filter((next) => !autoTracked || (next !== 'shipped' && next !== 'delivered')),
    [status, autoTracked],
  )
  const canShip = (status === 'paid' || status === 'processing') && !shipment

  const run = (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(key)
    setError('')
    startTransition(async () => {
      const result = await fn()
      setBusy(null)
      if (!result.ok) {
        setError(result.error ?? 'Operacja nie powiodła się.')
        toast.error(result.error ?? 'Operacja nie powiodła się.')
        return
      }
      toast.success(success)
      router.refresh()
    })
  }

  const setStatus = (next: OrderStatus) => {
    const meta = STATUS_ACTIONS[next]
    if (meta?.confirm && !window.confirm(meta.confirm)) return
    run(next, () => adminUpdateOrderStatus(orderId, next), 'Status zaktualizowany')
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBox>{error}</ErrorBox>}

      {autoTracked && (status === 'processing' || status === 'shipped') && (
        <p className="m-0 text-xs text-text-2">
          Wysłanie i doręczenie zaznacza się samo — status przychodzi z Furgonetki.
        </p>
      )}

      {allowed.length ? (
        <div className="flex flex-wrap gap-2">
          {allowed.map((next) => {
            const meta = STATUS_ACTIONS[next]
            if (!meta) return null
            const Icon = meta.icon
            return (
              <Button
                key={next}
                size="sm"
                variant={meta.variant ?? 'secondary'}
                disabled={pending}
                onClick={() => setStatus(next)}
              >
                <Icon size={14} strokeWidth={1.5} />
                {busy === next ? 'Chwileczkę…' : meta.label}
              </Button>
            )
          })}
        </div>
      ) : (
        !autoTracked && <p className="m-0 text-xs text-text-2">
          {status === 'pending' || status === 'awaiting_payment'
            ? 'Zamówienie czeka na płatność — status zmieni się sam po potwierdzeniu od operatora.'
            : 'To zamówienie jest domknięte — nie ma na nim nic do zrobienia.'}
        </p>
      )}

      {shipment ? (
        <ShipmentBox orderId={orderId} shipment={shipment} pending={pending} run={run} busy={busy} />
      ) : canShip ? (
        isPickupPoint ? (
          <ManualShipment orderId={orderId} pending={pending} run={run} busy={busy} defaultCarrier={shippingMethod} pickup />
        ) : (
          <FurgonetkaShipment orderId={orderId} pending={pending} run={run} busy={busy} defaultService={shippingMethod} />
        )
      ) : null}
    </div>
  )
}

type Runner = (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => void

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xs border border-border bg-surface p-3.5">
      <strong className="block text-xs font-semibold text-text">{title}</strong>
      {hint && <p className="mt-1 mb-0 text-[11px] leading-[1.5] text-text-2">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  )
}

function NumberField({ label, value, onChange, step = '1' }: { label: string; value: number; onChange: (value: number) => void; step?: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] font-medium text-text-2">{label}</span>
      <CellInput
        type="number"
        min="0"
        step={step}
        value={Number.isFinite(value) ? value : ''}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-24"
      />
    </label>
  )
}

function FurgonetkaShipment({
  orderId, pending, run, busy, defaultService,
}: { orderId: string; pending: boolean; run: Runner; busy: string | null; defaultService: string }) {
  const [service, setService] = useState(defaultService)
  const [parcel, setParcel] = useState(DEFAULT_PARCEL)
  const [manual, setManual] = useState(false)

  if (manual) {
    return <ManualShipment orderId={orderId} pending={pending} run={run} busy={busy} defaultCarrier={defaultService} onCancel={() => setManual(false)} />
  }

  return (
    <Section title="Nadaj przesyłkę przez Furgonetkę" hint="Paczka kurierska na adres z zamówienia, odbiór z adresu wybranego w Ustawieniach → Integracje. Przycisk tworzy i od razu ZAMAWIA przesyłkę (opłata z salda Furgonetki) — potem etykieta i automatyczne statusy.">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1">
          <span className="text-[11px] font-medium text-text-2" title="Kod usługi z konta Furgonetki (np. dpd, inpostkurier) albo jej liczbowe id">Kod usługi</span>
          <CellInput value={service} onChange={(event) => setService(event.target.value)} className="w-36 font-mono" />
        </label>
        <NumberField label="Waga (kg)" step="0.1" value={parcel.weightKg} onChange={(weightKg) => setParcel((p) => ({ ...p, weightKg }))} />
        <NumberField label="Szer. (cm)" value={parcel.widthCm} onChange={(widthCm) => setParcel((p) => ({ ...p, widthCm }))} />
        <NumberField label="Wys. (cm)" value={parcel.heightCm} onChange={(heightCm) => setParcel((p) => ({ ...p, heightCm }))} />
        <NumberField label="Dł. (cm)" value={parcel.depthCm} onChange={(depthCm) => setParcel((p) => ({ ...p, depthCm }))} />
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run('ship', () => adminCreateShipment({ orderId, service, parcel }), 'Przesyłka utworzona')}
        >
          <PackagePlus size={14} strokeWidth={1.5} />
          {busy === 'ship' ? 'Zamawiam…' : 'Utwórz i zamów przesyłkę'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setManual(true)}>
          Nadano poza Furgonetką
        </Button>
      </div>
    </Section>
  )
}

function ManualShipment({
  orderId, pending, run, busy, defaultCarrier, pickup, onCancel,
}: {
  orderId: string
  pending: boolean
  run: Runner
  busy: string | null
  defaultCarrier: string
  pickup?: boolean
  onCancel?: () => void
}) {
  const [carrier, setCarrier] = useState(defaultCarrier)
  const [tracking, setTracking] = useState('')

  return (
    <Section
      title="Zarejestruj przesyłkę"
      hint={
        pickup
          ? 'Zamówienie do punktu odbioru — nadaj paczkę w panelu Furgonetki (lub u przewoźnika) i wpisz tu numer przesyłki.'
          : 'Dla paczek nadanych poza API: wpisz przewoźnika i numer, a status zmienisz ręcznie.'
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1">
          <span className="text-[11px] font-medium text-text-2">Przewoźnik</span>
          <CellInput value={carrier} onChange={(event) => setCarrier(event.target.value)} className="w-36" />
        </label>
        <label className="grid gap-1">
          <span className="text-[11px] font-medium text-text-2">Numer przesyłki</span>
          <CellInput value={tracking} onChange={(event) => setTracking(event.target.value)} className="w-56 font-mono" />
        </label>
        <Button
          size="sm"
          disabled={pending || !tracking.trim()}
          onClick={() =>
            run('manual', () => adminRegisterShipment({ orderId, carrier, trackingNumber: tracking }), 'Przesyłka zarejestrowana')
          }
        >
          <Tag size={14} strokeWidth={1.5} />
          {busy === 'manual' ? 'Zapisuję…' : 'Zapisz przesyłkę'}
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Wróć do Furgonetki
          </Button>
        )}
      </div>
    </Section>
  )
}

function ShipmentBox({
  orderId, shipment, pending, run, busy,
}: { orderId: string; shipment: NonNullable<Shipment>; pending: boolean; run: Runner; busy: string | null }) {
  const manual = !shipment.furgonetkaId
  const ordered = Boolean(shipment.trackingNumber)

  return (
    <Section
      title={`Przesyłka · ${shipment.carrier}`}
      hint={
        manual
          ? 'Nadana poza API — status aktualizujesz ręcznie.'
          : ordered
            ? 'Status aktualizuje się sam z Furgonetki (webhook). „Odśwież status” pyta Furgonetkę od razu.'
            : 'Przesyłka utworzona, ale nie zamówiona — bez zamówienia nie ma kuriera ani etykiety.'
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        {shipment.trackingNumber && (
          <code className="rounded-xs border border-border bg-surface-muted px-2 py-1 font-mono text-[11px] text-text">
            {shipment.trackingNumber}
          </code>
        )}
        {manual ? (
          <PillSelect
            label="Status przesyłki"
            value={shipment.status}
            disabled={pending}
            onChange={(value) =>
              run('shipment-status', () => adminSetShipmentStatus(orderId, value as ShipmentStatus), 'Status przesyłki zapisany')
            }
            options={Object.entries(ShipmentStatusLabel).map(([value, label]) => ({ value, label }))}
          />
        ) : (
          <>
            <span className="text-xs font-medium text-text">{ShipmentStatusLabel[shipment.status] ?? shipment.status}</span>
            {ordered ? (
              <a
                href={`/api/admin/orders/${orderId}/label`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-xs bg-primary px-2.5 text-xs font-medium text-white shadow-1 transition-colors hover:bg-text-2'
                )}
              >
                <FileDown size={14} strokeWidth={1.5} />
                Etykieta (PDF)
              </a>
            ) : (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => run('order', () => adminOrderShipment(orderId), 'Przesyłka zamówiona')}
              >
                <Truck size={14} strokeWidth={1.5} />
                {busy === 'order' ? 'Zamawiam…' : 'Zamów kuriera'}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run('refresh', async () => {
                  const result = await adminRefreshShipment(orderId)
                  if (result.ok) toast(result.data)
                  return result
                }, 'Sprawdzono w Furgonetce')
              }
            >
              <RefreshCw size={14} strokeWidth={1.5} />
              {busy === 'refresh' ? 'Sprawdzam…' : 'Odśwież status'}
            </Button>
          </>
        )}
      </div>
    </Section>
  )
}
