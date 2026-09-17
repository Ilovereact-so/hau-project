'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CreditCard, RefreshCw, X } from 'lucide-react'
import { OrderStatusLabel, PaymentProviderLabel, PaymentTxLabel } from '@/lib/admin/labels'
import { Badge, ORDER_STATUS_TONES, PAYMENT_TX_TONES, toneFor } from '../kit/Badge'
import { Button } from '../kit/Button'
import { Card, CardHeader } from '../kit/Card'
import { DataTable, Td, Th, Tr } from '../kit/DataTable'
import { EmptyState } from '../kit/EmptyState'
import { PillButton, PillSelect } from '../kit/Pill'
import { formatCentsPrecise, formatDateTime, orderNumber } from '../kit/format'
import { useQueryNav } from '../orders/useQueryNav'

export type PaymentRow = {
  id: string
  orderId: string
  provider: string
  externalId: string | null
  status: string
  amountCents: number
  createdAt: Date | null
  updatedAt: Date | null
  orderStatus: string | null
}

export function PaymentsTable({ rows, total, page, limit }: { rows: PaymentRow[]; total: number; page: number; limit: number }) {
  const router = useRouter()
  const nav = useQueryNav()
  const status = nav.get('status')
  const provider = nav.get('provider')
  const pageCount = Math.max(1, Math.ceil(total / limit))

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={CreditCard}
        title="Transakcje"
        subtitle="Statusy ustawiają powiadomienia z bramek (ITN Autopay, IPN Przelewy24). Kliknij wiersz, aby otworzyć zamówienie."
        actions={
          <>
            <PillSelect
              label="Status transakcji"
              value={status}
              onChange={(value) => nav.set({ status: value })}
              options={[{ value: '', label: 'Wszystkie statusy' }, ...Object.entries(PaymentTxLabel).map(([value, label]) => ({ value, label }))]}
            />
            <PillSelect
              label="Operator"
              value={provider}
              onChange={(value) => nav.set({ provider: value })}
              options={[{ value: '', label: 'Wszyscy operatorzy' }, ...Object.entries(PaymentProviderLabel).map(([value, label]) => ({ value, label }))]}
            />
            {(status || provider) && (
              <PillButton icon={X} onClick={() => router.push('/admin/payments')}>
                Wyczyść
              </PillButton>
            )}
            <PillButton icon={RefreshCw} onClick={nav.refresh} disabled={nav.pending}>
              Odśwież
            </PillButton>
          </>
        }
      />
      <div className={`px-4 pt-3 pb-4 transition-opacity ${nav.pending ? 'opacity-60' : ''}`}>
        {rows.length ? (
          <>
            <DataTable>
              <thead>
                <tr>
                  <Th>Zamówienie</Th>
                  <Th>Operator</Th>
                  <Th>Transakcja</Th>
                  <Th>Status zamówienia</Th>
                  <Th className="text-right">Kwota</Th>
                  <Th>Utworzona</Th>
                  <Th>Ostatnia zmiana</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((payment) => (
                  <Tr key={payment.id} className="cursor-pointer" onClick={() => router.push(`/admin/orders/${payment.orderId}`)}>
                    <Td>
                      <Link href={`/admin/orders/${payment.orderId}`} onClick={(event) => event.stopPropagation()} className="font-mono text-[11px] font-medium text-text">
                        {orderNumber(payment.orderId)}
                      </Link>
                      {payment.externalId && (
                        <code className="block max-w-[180px] truncate font-mono text-[10px] text-text-2" title={payment.externalId}>
                          {payment.externalId}
                        </code>
                      )}
                    </Td>
                    <Td>{PaymentProviderLabel[payment.provider] ?? payment.provider}</Td>
                    <Td>
                      <Badge tone={toneFor(PAYMENT_TX_TONES, payment.status)}>{PaymentTxLabel[payment.status] ?? payment.status}</Badge>
                    </Td>
                    <Td>
                      {payment.orderStatus ? (
                        <Badge tone={toneFor(ORDER_STATUS_TONES, payment.orderStatus)}>{OrderStatusLabel[payment.orderStatus] ?? payment.orderStatus}</Badge>
                      ) : (
                        <span className="text-text-2">zamówienie usunięte</span>
                      )}
                    </Td>
                    <Td className="text-right font-medium whitespace-nowrap">{formatCentsPrecise(payment.amountCents)}</Td>
                    <Td className="whitespace-nowrap text-text-2">{formatDateTime(payment.createdAt)}</Td>
                    <Td className="whitespace-nowrap text-text-2">{formatDateTime(payment.updatedAt)}</Td>
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
                Strona {page} z {pageCount} · {total} transakcji
              </span>
              <Button variant="secondary" size="sm" disabled={page >= pageCount || nav.pending} onClick={() => nav.set({ page: String(page + 1) })}>
                Następne
                <ChevronRight size={14} strokeWidth={1.5} />
              </Button>
            </div>
          </>
        ) : (
          <EmptyState icon={<CreditCard size={20} strokeWidth={1.5} />} title="Brak transakcji">
            {status || provider ? 'Żadna transakcja nie pasuje do filtrów.' : 'Transakcje pojawią się po pierwszej płatności online.'}
          </EmptyState>
        )}
      </div>
    </Card>
  )
}
