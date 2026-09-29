'use client'

import { useMemo, useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Pencil, Plus, ReceiptText, TicketPercent, Trash2, Wallet } from 'lucide-react'
import type { AdminDiscountCode, AdminDiscountsData } from '@/lib/admin/discounts'
import { adminDeleteDiscountCode, adminSaveDiscountCode, adminSetDiscountCodeActive } from '@/actions/adminDiscounts'
import { discountBenefitLabel } from '@/lib/discounts'
import { OrderStatusLabel } from '@/lib/admin/labels'
import { Badge, ORDER_STATUS_TONES, toneFor, type BadgeTone } from '../kit/Badge'
import { Button, IconButton } from '../kit/Button'
import { Card, CardHeader } from '../kit/Card'
import { DataTable, Td, Th, Tr } from '../kit/DataTable'
import { EmptyNote, EmptyState } from '../kit/EmptyState'
import { Modal } from '../kit/Modal'
import { StatCard } from '../kit/StatCard'
import { SelectField, TextField } from '../kit/TextField'
import { Toggle } from '../kit/Toggle'
import { formatCentsPrecise, formatDate, formatDateTime, orderNumber } from '../kit/format'

const STATUS: Record<AdminDiscountCode['status'], { label: string; tone: BadgeTone }> = {
  active: { label: 'Aktywny', tone: 'success' },
  scheduled: { label: 'Zaplanowany', tone: 'info' },
  expired: { label: 'Wygasł', tone: 'neutral' },
  exhausted: { label: 'Limit wyczerpany', tone: 'primary' },
  disabled: { label: 'Wyłączony', tone: 'neutral' },
}

const TYPE_OPTIONS = [
  { value: 'percent', label: 'Procent od produktów' },
  { value: 'fixed', label: 'Kwota od produktów' },
  { value: 'free_shipping', label: 'Darmowa dostawa' },
]

function conditions(code: AdminDiscountCode): string {
  const parts: string[] = []
  if (code.minSubtotalCents > 0) parts.push(`od ${formatCentsPrecise(code.minSubtotalCents)}`)
  if (code.type === 'percent' && code.maxDiscountCents) parts.push(`maks. ${formatCentsPrecise(code.maxDiscountCents)}`)
  if (code.usageLimitPerUser) parts.push(`${code.usageLimitPerUser}× na klienta`)
  if (code.endsAt) parts.push(`do ${formatDate(code.endsAt)}`)
  if (code.startsAt && new Date(code.startsAt) > new Date()) parts.push(`od ${formatDate(code.startsAt)}`)
  return parts.join(' · ') || 'Bez warunków'
}

export function DiscountCodesView({ data }: { data: AdminDiscountsData }) {
  const router = useRouter()
  const [editing, setEditing] = useState<AdminDiscountCode | 'new' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const activeCount = useMemo(() => data.codes.filter((c) => c.status === 'active').length, [data.codes])

  const toggle = async (code: AdminDiscountCode) => {
    setBusy(code.id)
    const result = await adminSetDiscountCodeActive(code.id, !code.isActive)
    setBusy(null)
    if (!result.ok) return toast.error(result.error)
    toast.success(code.isActive ? `Kod ${code.code} wyłączony` : `Kod ${code.code} włączony`)
    router.refresh()
  }

  const remove = async (code: AdminDiscountCode) => {
    if (!window.confirm(`Usunąć kod ${code.code}? Tej operacji nie można cofnąć.`)) return
    setBusy(code.id)
    const result = await adminDeleteDiscountCode(code.id)
    setBusy(null)
    if (!result.ok) return toast.error(result.error)
    toast.success(`Kod ${code.code} usunięty`)
    router.refresh()
  }

  return (
    <section className="flex flex-col gap-4 animate-fade-in">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={TicketPercent} label="Aktywne kody" value={String(activeCount)} delta={`${data.codes.length} łącznie`} />
        <StatCard icon={ReceiptText} label="Zamówienia z kodem" value={String(data.totals.redemptions)} delta="bez anulowanych" />
        <StatCard icon={Wallet} label="Udzielone rabaty" value={formatCentsPrecise(data.totals.discountCents)} />
        <StatCard icon={Wallet} label="Przychód z kodami" value={formatCentsPrecise(data.totals.revenueCents)} delta="opłacone zamówienia" tone="up" />
      </div>

      <Card className="flex flex-col">
        <CardHeader
          icon={TicketPercent}
          title="Kody rabatowe"
          subtitle="Klient wpisuje kod w koszyku. Rabat liczy serwer i zapisuje w zamówieniu — widać go w szczegółach zamówienia i w eksporcie CSV."
          actions={
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus size={14} strokeWidth={1.8} />
              Nowy kod
            </Button>
          }
        />
        <div className="px-4 pt-3 pb-4">
          {data.codes.length === 0 ? (
            <EmptyState icon={<TicketPercent size={18} strokeWidth={1.5} />} title="Brak kodów rabatowych">
              Utwórz pierwszy kod — np. rabat powitalny z newslettera albo darmową dostawę od określonej kwoty.
            </EmptyState>
          ) : (
            <DataTable>
              <thead>
                <tr>
                  <Th>Kod</Th>
                  <Th>Korzyść</Th>
                  <Th>Warunki</Th>
                  <Th>Użycia</Th>
                  <Th>Rabaty / przychód</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Aktywny</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {data.codes.map((code) => {
                  const status = STATUS[code.status]
                  return (
                    <Tr key={code.id}>
                      <Td>
                        <p className="m-0 font-mono text-[13px] font-semibold tracking-wide">{code.code}</p>
                        {code.description && <p className="mt-0.5 mb-0 max-w-[260px] truncate text-[11px] text-text-2">{code.description}</p>}
                      </Td>
                      <Td className="font-medium whitespace-nowrap">{discountBenefitLabel(code)}</Td>
                      <Td className="text-text-2">{conditions(code)}</Td>
                      <Td className="whitespace-nowrap tabular-nums">
                        {code.timesUsed}
                        {code.usageLimit ? <span className="text-text-2"> / {code.usageLimit}</span> : null}
                      </Td>
                      <Td className="whitespace-nowrap tabular-nums">
                        <span className="text-danger">−{formatCentsPrecise(code.totalDiscountCents)}</span>
                        <span className="text-text-2"> · {formatCentsPrecise(code.revenueCents)}</span>
                      </Td>
                      <Td>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </Td>
                      <Td className="text-right">
                        <span className="inline-flex">
                          <Toggle
                            checked={code.isActive}
                            onChange={() => void toggle(code)}
                            label={code.isActive ? 'Wyłącz kod' : 'Włącz kod'}
                            disabled={busy === code.id}
                          />
                        </span>
                      </Td>
                      <Td className="text-right">
                        <span className="inline-flex gap-1.5">
                          <IconButton label="Edytuj" onClick={() => setEditing(code)}>
                            <Pencil size={13} strokeWidth={1.5} />
                          </IconButton>
                          {code.timesUsed === 0 && (
                            <IconButton label="Usuń" onClick={() => void remove(code)} disabled={busy === code.id}>
                              <Trash2 size={13} strokeWidth={1.5} />
                            </IconButton>
                          )}
                        </span>
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </DataTable>
          )}
        </div>
      </Card>

      <Card className="flex flex-col">
        <CardHeader
          icon={ReceiptText}
          title="Ostatnie użycia"
          subtitle="Zamówienia złożone z kodem. Anulowanie zamówienia w panelu oddaje użycie kodu (limity)."
        />
        <div className="px-4 pt-3 pb-4">
          {data.recent.length === 0 ? (
            <EmptyNote>Żadne zamówienie nie użyło jeszcze kodu rabatowego.</EmptyNote>
          ) : (
            <DataTable>
              <thead>
                <tr>
                  <Th>Zamówienie</Th>
                  <Th>Kod</Th>
                  <Th>Klient</Th>
                  <Th>Rabat</Th>
                  <Th>Do zapłaty</Th>
                  <Th>Status</Th>
                  <Th>Data</Th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r) => (
                  <Tr key={r.orderId}>
                    <Td>
                      <Link href={`/admin/orders/${r.orderId}`} className="font-medium text-text underline-offset-2 hover:underline">
                        #{orderNumber(r.orderId)}
                      </Link>
                    </Td>
                    <Td className="font-mono font-semibold">{r.code}</Td>
                    <Td className="text-text-2">{r.email}</Td>
                    <Td className="text-danger tabular-nums">−{formatCentsPrecise(r.discountCents)}</Td>
                    <Td className="tabular-nums">{formatCentsPrecise(r.totalCents)}</Td>
                    <Td>
                      <Badge tone={toneFor(ORDER_STATUS_TONES, r.status)}>{OrderStatusLabel[r.status] ?? r.status}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-text-2">{formatDateTime(r.createdAt)}</Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </div>
      </Card>

      {editing && (
        <DiscountCodeModal
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      )}
    </section>
  )
}

// ─── formularz ────────────────────────────────────────────────────────────────

/** ISO (UTC) → wartość `datetime-local` w strefie przeglądarki. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

const plnToCents = (value: string) => Math.round(parseFloat(value.replace(',', '.')) * 100)
const centsToPln = (cents: number | null) => (cents ? (cents / 100).toFixed(2).replace('.', ',') : '')

function DiscountCodeModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: AdminDiscountCode | null
  onClose: () => void
  onSaved: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    code: initial?.code ?? '',
    description: initial?.description ?? '',
    type: initial?.type ?? 'percent',
    value: initial ? (initial.type === 'fixed' ? centsToPln(initial.value) : initial.type === 'percent' ? String(initial.value) : '') : '10',
    minSubtotal: centsToPln(initial?.minSubtotalCents ?? 0),
    maxDiscount: centsToPln(initial?.maxDiscountCents ?? null),
    startsAt: toLocalInput(initial?.startsAt ?? null),
    endsAt: toLocalInput(initial?.endsAt ?? null),
    usageLimit: initial?.usageLimit ? String(initial.usageLimit) : '',
    usageLimitPerUser: initial?.usageLimitPerUser ? String(initial.usageLimitPerUser) : '',
    isActive: initial?.isActive ?? true,
  })
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    startTransition(async () => {
      const value =
        form.type === 'percent' ? Number(form.value) : form.type === 'fixed' ? plnToCents(form.value || '0') : 0
      const result = await adminSaveDiscountCode({
        id: initial?.id,
        code: form.code,
        description: form.description,
        type: form.type,
        value,
        minSubtotalCents: form.minSubtotal ? plnToCents(form.minSubtotal) : 0,
        maxDiscountCents: form.maxDiscount ? plnToCents(form.maxDiscount) : null,
        startsAt: fromLocalInput(form.startsAt),
        endsAt: fromLocalInput(form.endsAt),
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        usageLimitPerUser: form.usageLimitPerUser ? Number(form.usageLimitPerUser) : null,
        isActive: form.isActive,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(initial ? 'Kod zapisany' : 'Kod utworzony')
      onSaved()
    })
  }

  return (
    <Modal
      as="form"
      onSubmit={submit}
      title={initial ? `Edycja kodu ${initial.code}` : 'Nowy kod rabatowy'}
      subtitle="Rabat procentowy i kwotowy liczy się od wartości produktów (bez dostawy). Jeden kod na zamówienie."
      onClose={onClose}
      width="w-[min(620px,100%)]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Anuluj
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Zapisuję…' : initial ? 'Zapisz zmiany' : 'Utwórz kod'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Kod"
          value={form.code}
          onChange={(e) => set('code', e.target.value.toUpperCase().replace(/\s+/g, ''))}
          placeholder="np. LATO15"
          maxLength={32}
          required
          className="font-mono uppercase"
          hint="Klient może wpisać małymi literami."
        />
        <SelectField
          label="Rodzaj"
          value={form.type}
          onChange={(e) => set('type', e.target.value as typeof form.type)}
          options={TYPE_OPTIONS}
        />
        {form.type !== 'free_shipping' && (
          <TextField
            label={form.type === 'percent' ? 'Rabat (%)' : 'Rabat (zł)'}
            value={form.value}
            onChange={(e) => set('value', e.target.value)}
            inputMode="decimal"
            required
          />
        )}
        {form.type === 'percent' && (
          <TextField
            label="Maksymalny rabat (zł)"
            value={form.maxDiscount}
            onChange={(e) => set('maxDiscount', e.target.value)}
            inputMode="decimal"
            placeholder="bez limitu"
          />
        )}
        <TextField
          label="Minimalna wartość produktów (zł)"
          value={form.minSubtotal}
          onChange={(e) => set('minSubtotal', e.target.value)}
          inputMode="decimal"
          placeholder="bez progu"
        />
        <TextField
          label="Opis (widoczny dla klienta)"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          maxLength={255}
          placeholder="np. Letnia wyprzedaż"
        />
        <TextField label="Ważny od" type="datetime-local" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
        <TextField label="Ważny do" type="datetime-local" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
        <TextField
          label="Limit użyć łącznie"
          value={form.usageLimit}
          onChange={(e) => set('usageLimit', e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          placeholder="bez limitu"
        />
        <TextField
          label="Limit na klienta"
          value={form.usageLimitPerUser}
          onChange={(e) => set('usageLimitPerUser', e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          placeholder="bez limitu"
          hint="Liczone po koncie i adresie e-mail."
        />
      </div>
      <label className="flex items-center gap-2.5 text-xs text-text">
        <Toggle checked={form.isActive} onChange={() => set('isActive', !form.isActive)} label="Kod aktywny" />
        Kod aktywny
      </label>
      {error && <p className="m-0 rounded-xs bg-danger/10 px-3 py-2 text-xs font-medium text-danger">{error}</p>}
    </Modal>
  )
}
