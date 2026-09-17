'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Download, RefreshCw, ShoppingBag, SlidersHorizontal, X,
} from 'lucide-react'
import type { AdminOrderRow } from '@/lib/admin/ordersQueries'
import {
  OrderStatusLabel, PaymentMethodLabel, PaymentTxLabel, ShipmentStatusLabel,
} from '@/lib/admin/labels'
import {
  Badge, Dot, ORDER_STATUS_TONES, PAYMENT_TX_TONES, SHIPMENT_TONES, toneFor,
} from '../kit/Badge'
import { Button, ButtonLink } from '../kit/Button'
import { Card, CardHeader } from '../kit/Card'
import { DataTable, Td, Th, Tr } from '../kit/DataTable'
import { EmptyState } from '../kit/EmptyState'
import { PillButton, PillDate, PillSelect } from '../kit/Pill'
import { formatCentsPrecise, formatDate, orderNumber } from '../kit/format'
import { useQueryNav } from './useQueryNav'

const PERIODS = [
  { value: '', label: 'Cały okres' },
  { value: '7', label: 'Ostatnie 7 dni' },
  { value: '30', label: 'Ostatnie 30 dni' },
  { value: '90', label: 'Ostatnie 90 dni' },
]

const options = (labels: Record<string, string>, allLabel: string) => [
  { value: '', label: allLabel },
  ...Object.entries(labels).map(([value, label]) => ({ value, label })),
]

export function OrdersView({
  rows,
  total,
  page,
  limit,
}: {
  rows: AdminOrderRow[]
  total: number
  page: number
  limit: number
}) {
  const router = useRouter()
  const nav = useQueryNav()
  const status = nav.get('status')
  const method = nav.get('method')
  const days = nav.get('days')
  const from = nav.get('from')
  const to = nav.get('to')
  const q = nav.get('q')
  const sortByValue = nav.get('sort') === 'value'
  const pageCount = Math.max(1, Math.ceil(total / limit))
  const filtered = Boolean(status || method || days || from || to || q)

  return (
    <section className="flex flex-col gap-4 animate-fade-in">
      <Card className="flex flex-col">
        <CardHeader
          icon={ShoppingBag}
          title="Lista zamówień"
          subtitle="Kliknij zamówienie, aby zobaczyć klienta, płatności i przesyłkę."
          actions={
            <>
              <PillSelect label="Status zamówienia" value={status} onChange={(value) => nav.set({ status: value })} options={options(OrderStatusLabel, 'Wszystkie statusy')} />
              <PillSelect label="Płatność" value={method} onChange={(value) => nav.set({ method: value })} options={options(PaymentMethodLabel, 'Płatność: wszystko')} />
              <PillSelect
                label="Okres"
                value={days}
                onChange={(value) => nav.set({ days: value, from: null, to: null })}
                options={PERIODS}
                disabled={Boolean(from)}
              />
              <PillDate label="Od" value={from} onChange={(value) => nav.set({ from: value, days: null })} />
              <PillDate label="Do" value={to} onChange={(value) => nav.set({ to: value })} />
              <PillButton icon={SlidersHorizontal} onClick={() => nav.set({ sort: sortByValue ? null : 'value' })}>
                {sortByValue ? 'Wg wartości' : 'Wg daty'}
              </PillButton>
              {filtered && (
                <PillButton icon={X} onClick={() => router.push('/admin/orders')}>
                  Wyczyść
                </PillButton>
              )}
              <PillButton icon={RefreshCw} onClick={nav.refresh} disabled={nav.pending}>
                Odśwież
              </PillButton>
              <ButtonLink href="/admin/orders/export" size="sm" variant="secondary">
                <Download size={14} strokeWidth={1.5} />
                Eksport CSV
              </ButtonLink>
            </>
          }
        />

        <div className={`px-4 pt-3 pb-4 transition-opacity ${nav.pending ? 'opacity-60' : ''}`}>
          {q && (
            <p className="mt-0 mb-3 text-xs text-text-2">
              Wyniki dla „<b className="text-text">{q}</b>” — numer, klient, e-mail, telefon, produkt lub kod rabatowy.
            </p>
          )}
          {rows.length ? (
            <>
              <DataTable>
                <thead>
                  <tr>
                    <Th>Zamówienie</Th>
                    <Th>Klient</Th>
                    <Th>Status</Th>
                    <Th>Płatność</Th>
                    <Th>Dostawa</Th>
                    <Th className="text-right">Wartość</Th>
                    <Th>Data</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((order) => (
                    <Tr key={order.id} className="cursor-pointer" onClick={() => router.push(`/admin/orders/${order.id}`)}>
                      <Td className="max-w-[260px]">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="flex items-center gap-2"
                        >
                          <Dot tone={toneFor(ORDER_STATUS_TONES, order.status)} />
                          <code className="font-mono text-[11px] font-medium text-text">{orderNumber(order.id)}</code>
                        </Link>
                        {order.itemSummary && (
                          <span className="mt-0.5 block truncate text-[11px] text-text-2">{order.itemSummary}</span>
                        )}
                      </Td>
                      <Td className="max-w-[220px]">
                        <span className="block truncate text-text">{order.customerName || (order.userId.startsWith('user_') ? 'Klient' : 'Gość')}</span>
                        <span className="block truncate text-[11px] text-text-2">{order.email}</span>
                      </Td>
                      <Td>
                        <Badge tone={toneFor(ORDER_STATUS_TONES, order.status)}>{OrderStatusLabel[order.status] ?? order.status}</Badge>
                      </Td>
                      <Td>
                        {order.paymentMethod === 'cod' ? (
                          <Badge tone="neutral">Za pobraniem</Badge>
                        ) : order.paymentStatus ? (
                          <Badge tone={toneFor(PAYMENT_TX_TONES, order.paymentStatus)}>{PaymentTxLabel[order.paymentStatus] ?? order.paymentStatus}</Badge>
                        ) : (
                          <Badge tone="neutral">Brak transakcji</Badge>
                        )}
                        <span className="mt-0.5 block truncate text-[11px] text-text-2">
                          {PaymentMethodLabel[order.paymentMethod] ?? order.paymentMethod}
                        </span>
                      </Td>
                      <Td>
                        {order.shipmentStatus ? (
                          <Badge tone={toneFor(SHIPMENT_TONES, order.shipmentStatus)}>
                            {ShipmentStatusLabel[order.shipmentStatus] ?? order.shipmentStatus}
                          </Badge>
                        ) : (
                          <Badge tone="neutral">Nie nadano</Badge>
                        )}
                        <span className="mt-0.5 block truncate text-[11px] text-text-2">
                          {order.trackingNumber || order.shippingMethod}
                        </span>
                      </Td>
                      <Td className="text-right font-medium whitespace-nowrap">{formatCentsPrecise(order.totalCents)}</Td>
                      <Td className="whitespace-nowrap text-text-2">{formatDate(order.createdAt)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </DataTable>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-text-2">
                <Button variant="secondary" size="sm" disabled={page <= 1 || nav.pending} onClick={() => nav.set({ page: String(page - 1) })}>
                  <ChevronLeft size={14} strokeWidth={1.5} />
                  Poprzednie
                </Button>
                <span>
                  Strona {page} z {pageCount} · {total} zamówień
                </span>
                <Button variant="secondary" size="sm" disabled={page >= pageCount || nav.pending} onClick={() => nav.set({ page: String(page + 1) })}>
                  Następne
                  <ChevronRight size={14} strokeWidth={1.5} />
                </Button>
              </div>
            </>
          ) : (
            <EmptyState icon={<ShoppingBag size={20} strokeWidth={1.5} />} title="Brak zamówień">
              {filtered
                ? 'Żadne zamówienie nie pasuje do ustawionych filtrów.'
                : 'Zamówienia pojawią się tutaj po pierwszym zakupie w sklepie.'}
            </EmptyState>
          )}
        </div>
      </Card>
    </section>
  )
}
