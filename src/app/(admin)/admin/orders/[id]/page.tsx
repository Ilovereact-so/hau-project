import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft, BadgeCheck, CreditCard, ExternalLink, MapPin, Package, ShoppingBag, StickyNote, Undo2, UserRound,
} from 'lucide-react'
import { getAdminOrderDetail } from '@/lib/admin/ordersQueries'
import {
  OrderStatusLabel, PaymentMethodLabel, PaymentProviderLabel, PaymentTxLabel, ShipmentStatusLabel,
} from '@/lib/admin/labels'
import {
  Badge, ORDER_STATUS_TONES, PAYMENT_TX_TONES, SHIPMENT_TONES, toneFor,
} from '@/components/admin/kit/Badge'
import { Card, CardHeader, Field, Line } from '@/components/admin/kit/Card'
import { DataTable, Td, Th, Tr } from '@/components/admin/kit/DataTable'
import { formatCentsPrecise, formatDateTime, orderNumber } from '@/components/admin/kit/format'
import { OrderActions } from '@/components/admin/orders/OrderActions'
import { OrderStockActions } from '@/components/admin/orders/OrderStockActions'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orderWithdrawals, orders, shipments } from '@/db/schema'
import { syncFurgonetkaShipment } from '@/lib/shipmentStatus'
import { RECONCILABLE_STATUSES, deductStockForOrder, getOrderStockInfo, type OrderStockInfo } from '@/lib/inventory.server'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

/**
 * Przesyłka czekająca w koszyku Furgonetki: przy otwarciu zamówienia pytamy
 * Furgonetkę, czy została już opłacona (zapas, gdy webhook nie dotarł).
 * Najwyżej 4 s — błąd albo wolne API nie blokuje strony.
 */
async function syncPendingShipment(orderId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return
  try {
    const [row] = await db
      .select({ id: shipments.id, orderId: shipments.orderId, status: shipments.status, furgonetkaId: shipments.furgonetkaId, trackingNumber: shipments.trackingNumber })
      .from(shipments)
      .where(eq(shipments.orderId, orderId))
    if (!row?.furgonetkaId || row.trackingNumber) return
    await Promise.race([
      syncFurgonetkaShipment({ ...row, furgonetkaId: row.furgonetkaId }),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ])
  } catch (err) {
    console.warn('[furgonetka] synchronizacja przesyłki przy otwarciu zamówienia', err)
  }
}

/**
 * Opłacone zamówienie, któremu stan jeszcze nie zszedł (awaria Sanity w chwili
 * ITN): otwarcie w panelu dogrywa zdjęcie — najwyżej 4 s, jak przy przesyłce.
 */
async function loadStock(orderId: string): Promise<OrderStockInfo | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null
  try {
    const info = await getOrderStockInfo(orderId)
    const [order] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId))
    if (info && order && RECONCILABLE_STATUSES.includes(order.status) && (info.state === 'none' || info.state === 'pending')) {
      await Promise.race([deductStockForOrder(orderId, 'reconcile'), new Promise((resolve) => setTimeout(resolve, 4000))])
      return await getOrderStockInfo(orderId)
    }
    return info
  } catch (err) {
    console.warn('[inventory] stan zamówienia w panelu', err)
    return null
  }
}

const STOCK_STATE_LABEL: Record<string, string> = {
  none: 'Stan nie został zdjęty',
  pending: 'Zdejmowanie niedokończone',
  deducted: 'Zdjęty ze stanu',
  restored: 'Oddany na magazyn',
  legacy: 'Sprzed automatycznego zdejmowania',
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params
  return { title: `Zamówienie ${orderNumber(id)}` }
}

export default async function AdminOrderDetailPage({ params }: { params: Params }) {
  const { id } = await params
  await syncPendingShipment(id)
  const stock = await loadStock(id)
  const [data, withdrawals] = await Promise.all([
    getAdminOrderDetail(id),
    // Oświadczenia o odstąpieniu złożone formularzem online (dopasowane do zamówienia).
    db.select().from(orderWithdrawals).where(eq(orderWithdrawals.orderId, id)).orderBy(desc(orderWithdrawals.createdAt))
      .catch((error) => { console.error('[admin/orders] withdrawals query failed', error); return [] }),
  ])
  if (!data) notFound()
  const { order, items, address, payments, shipment, customerOrderCount } = data
  const isGuest = !order.userId.startsWith('user_')
  const units = items.reduce((sum, item) => sum + item.qty, 0)
  const itemLabel = new Map(items.map((item) => [`${item.productId}::${item.variantId ?? ''}`, item.variantLabel ? `${item.name} (${item.variantLabel})` : item.name]))
  const stockState = stock?.state ?? 'none'
  const isPaidStatus = RECONCILABLE_STATUSES.includes(order.status)
  const canRestock = (order.status === 'refunded' || order.status === 'cancelled') && (stockState === 'deducted' || stockState === 'pending')
  const canDeduct = isPaidStatus && (stockState === 'none' || stockState === 'pending')

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <Link href="/admin/orders" className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-text-2 hover:text-text">
        <ArrowLeft size={14} strokeWidth={1.5} />
        Wszystkie zamówienia
      </Link>

      <Card className="flex flex-col">
        <CardHeader
          icon={BadgeCheck}
          title={`Zamówienie ${orderNumber(order.id)}`}
          subtitle={
            <>
              Złożone {formatDateTime(order.createdAt)} · ostatnia zmiana {formatDateTime(order.updatedAt)} ·{' '}
              <code className="font-mono text-[11px]">{order.id}</code>
            </>
          }
          actions={
            <>
              <Badge tone={toneFor(ORDER_STATUS_TONES, order.status)}>{OrderStatusLabel[order.status] ?? order.status}</Badge>
              <Badge tone={order.paymentMethod === 'cod' ? 'neutral' : toneFor(PAYMENT_TX_TONES, payments[0]?.status)}>
                {order.paymentMethod === 'cod'
                  ? 'Za pobraniem'
                  : payments[0]
                    ? `Płatność: ${PaymentTxLabel[payments[0].status] ?? payments[0].status}`
                    : 'Brak transakcji'}
              </Badge>
              <Badge tone={shipment ? toneFor(SHIPMENT_TONES, shipment.status) : 'neutral'}>
                {shipment ? ShipmentStatusLabel[shipment.status] ?? shipment.status : 'Nie nadano'}
              </Badge>
            </>
          }
        />
        <div className="px-4 pt-3 pb-4">
          <OrderActions
            orderId={order.id}
            status={order.status}
            shipment={shipment}
            shippingMethod={order.shippingMethod}
            isPickupPoint={Boolean(address?.pickupPointCode)}
          />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="flex min-w-0 flex-col">
          <CardHeader icon={ShoppingBag} title="Pozycje zamówienia" subtitle={`${items.length} pozycji · ${units} szt.`} />
          <div className="px-4 pt-3 pb-4">
            <DataTable>
              <thead>
                <tr>
                  <Th>Produkt</Th>
                  <Th className="text-right">Ilość</Th>
                  <Th className="text-right">Cena</Th>
                  <Th className="text-right">Wartość</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <Tr key={item.id}>
                    <Td>
                      <span className="flex items-center gap-3">
                        <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xs border border-border bg-surface-muted">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl.includes('cdn.sanity.io') ? `${item.imageUrl.split('?')[0]}?w=96&h=96&fit=crop` : item.imageUrl}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : null}
                        </span>
                        <span className="min-w-0">
                          {item.brand && <span className="block text-[11px] text-text-2">{item.brand}</span>}
                          <span className="block font-medium text-text">{item.name}</span>
                          {item.variantLabel && <span className="block text-[11px] text-text-2">{item.variantLabel}</span>}
                        </span>
                      </span>
                    </Td>
                    <Td className="text-right">{item.qty}</Td>
                    <Td className="text-right whitespace-nowrap">{formatCentsPrecise(item.priceCents)}</Td>
                    <Td className="text-right font-medium whitespace-nowrap">{formatCentsPrecise(item.priceCents * item.qty)}</Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>

            <dl className="mt-4 ml-auto flex max-w-sm flex-col gap-1.5 text-xs">
              <Line label="Wartość produktów" value={formatCentsPrecise(order.subtotalCents)} />
              <Line label={`Dostawa (${order.shippingMethod})`} value={formatCentsPrecise(order.shippingCents)} />
              {order.discountCents > 0 && (
                <Line
                  label={`Rabat${order.discountCode ? ` (${order.discountCode})` : ''}`}
                  value={`−${formatCentsPrecise(order.discountCents)}`}
                  tone="success"
                />
              )}
              <Line label="Razem" value={formatCentsPrecise(order.totalCents)} strong />
              <Line
                label="Zaksięgowano online"
                value={formatCentsPrecise(
                  payments.filter((payment) => payment.status === 'success').reduce((sum, payment) => sum + payment.amountCents, 0)
                )}
              />
            </dl>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col">
            <CardHeader icon={UserRound} title="Klient" />
            <div className="flex flex-col gap-3 px-4 pt-3 pb-4 text-xs">
              <Field label="Kontakt">
                {address ? `${address.firstName} ${address.lastName}` : '—'}
                <br />
                <a href={`mailto:${address?.email ?? order.guestEmail ?? ''}`} className="text-text-2 hover:text-text">
                  {address?.email || order.guestEmail || 'brak e-maila'}
                </a>
                {address?.phone && (
                  <>
                    <br />
                    <a href={`tel:${address.phone}`} className="text-text-2 hover:text-text">{address.phone}</a>
                  </>
                )}
              </Field>
              <Field label="Konto">
                {isGuest ? 'Zakup jako gość' : 'Zalogowany klient'} ·{' '}
                <Link href={`/admin/orders?q=${encodeURIComponent(order.userId)}`} className="text-text-2 underline-offset-2 hover:text-text hover:underline">
                  {customerOrderCount} {customerOrderCount === 1 ? 'zamówienie' : 'zamówień'}
                </Link>
              </Field>
            </div>
          </Card>

          <Card className="flex flex-col">
            <CardHeader icon={MapPin} title="Dostawa" />
            <div className="flex flex-col gap-3 px-4 pt-3 pb-4 text-xs">
              <Field label={address?.pickupPointCode ? 'Punkt odbioru' : 'Adres dostawy'}>
                {!address ? (
                  '—'
                ) : address.pickupPointCode ? (
                  <>
                    {address.pickupPointName || address.pickupPointCode}
                    <br />
                    <code className="font-mono text-[11px] text-text-2">{address.pickupPointCode}</code>
                  </>
                ) : (
                  <>
                    {address.street}
                    {address.apartment_number ? ` / ${address.apartment_number}` : ''}
                    <br />
                    {[address.postalCode, address.city].filter(Boolean).join(' ')} · {address.country}
                  </>
                )}
              </Field>
              <Field label="Sposób dostawy">
                <code className="font-mono text-[11px]">{order.shippingMethod}</code> · {formatCentsPrecise(order.shippingCents)}
              </Field>
              {shipment && (
                <Field label="Przesyłka">
                  {shipment.carrier} · {ShipmentStatusLabel[shipment.status] ?? shipment.status}
                  {shipment.trackingNumber && (
                    <>
                      <br />
                      <code className="font-mono text-[11px] text-text-2">{shipment.trackingNumber}</code>
                    </>
                  )}
                  <br />
                  <span className="text-text-2">utworzona {formatDateTime(shipment.createdAt)}</span>
                </Field>
              )}
            </div>
          </Card>

          <Card className="flex flex-col">
            <CardHeader icon={CreditCard} title="Płatność" />
            <div className="flex flex-col gap-3 px-4 pt-3 pb-4 text-xs">
              <Field label="Sposób zapłaty">{PaymentMethodLabel[order.paymentMethod] ?? order.paymentMethod}</Field>
              <Field label="Transakcje">
                {payments.length ? (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {payments.map((payment) => (
                      <li key={payment.id} className="rounded-xs border border-border bg-surface px-2.5 py-2">
                        <span className="flex items-center justify-between gap-2">
                          <b className="font-medium">{PaymentProviderLabel[payment.provider] ?? payment.provider}</b>
                          <Badge tone={toneFor(PAYMENT_TX_TONES, payment.status)}>{PaymentTxLabel[payment.status] ?? payment.status}</Badge>
                        </span>
                        <span className="mt-1 block text-text-2">
                          {formatCentsPrecise(payment.amountCents)} · {formatDateTime(payment.updatedAt ?? payment.createdAt)}
                        </span>
                        {payment.externalId && (
                          <code className="mt-0.5 block truncate font-mono text-[10px] text-text-2" title={payment.externalId}>
                            {payment.externalId}
                          </code>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : order.paymentMethod === 'cod' ? (
                  'Płatność przy odbiorze — brak transakcji online.'
                ) : (
                  'Brak zarejestrowanej transakcji.'
                )}
              </Field>
              <Link href="/admin/payments" className="inline-flex items-center gap-1 text-[11px] font-medium text-text-2 hover:text-text">
                Wszystkie płatności <ExternalLink size={11} strokeWidth={1.5} />
              </Link>
            </div>
          </Card>

          {stock && (
            <Card className="flex flex-col">
              <CardHeader
                icon={Package}
                title="Magazyn"
                subtitle={
                  stockState === 'none' && !isPaidStatus
                    ? order.status === 'cancelled'
                      ? 'Zamówienie nie zostało opłacone — stan nie był zdejmowany.'
                      : 'Stan zejdzie automatycznie po opłaceniu zamówienia.'
                    : order.status === 'refunded' && stockState === 'deducted'
                      ? 'Zwrot: gdy paczka wróci i towar nadaje się do sprzedaży, oddaj go na stan.'
                      : undefined
                }
                actions={
                  <Badge tone={stockState === 'deducted' ? 'success' : stockState === 'restored' ? 'info' : stockState === 'pending' ? 'danger' : 'neutral'}>
                    {STOCK_STATE_LABEL[stockState] ?? stockState}
                  </Badge>
                }
              />
              <div className="flex flex-col gap-3 px-4 pt-3 pb-4 text-xs text-text">
                {stock.note && (
                  <p className="m-0 rounded-xs border border-danger/30 bg-danger/10 px-2.5 py-2 font-medium text-danger">{stock.note}</p>
                )}
                {stock.movements.length > 0 && (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {stock.movements.map((move) => (
                      <li key={`${move.kind}-${move.productId}-${move.variantKey}`} className="flex flex-col gap-0.5">
                        <span className="font-medium">{itemLabel.get(`${move.productId}::${move.variantKey}`) ?? move.productId}</span>
                        <span className="text-text-2">
                          {move.target === 'untracked'
                            ? 'stan nieprowadzony — bez zmian'
                            : `${move.kind === 'deduct' ? 'zdjęto' : 'oddano'} ${move.appliedQty} szt.${
                                move.kind === 'deduct' && move.appliedQty < move.requestedQty ? ` z ${move.requestedQty}` : ''
                              } · stan ${move.stockBefore ?? '—'} → ${move.stockAfter ?? '—'}${move.target === 'product' ? ' (wspólny stan produktu)' : ''}`}
                          {' · '}
                          {formatDateTime(move.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <OrderStockActions orderId={order.id} canRestock={canRestock} canDeduct={canDeduct} />
              </div>
            </Card>
          )}

          {withdrawals.length > 0 && (
            <Card className="flex flex-col">
              <CardHeader icon={Undo2} title="Odstąpienie od umowy" subtitle="Oświadczenie złożone formularzem online — zwrot płatności w ciągu 14 dni." />
              <div className="flex flex-col gap-3 px-4 pt-3 pb-4 text-xs text-text">
                {withdrawals.map((entry) => (
                  <div key={entry.id} className="flex flex-col gap-1">
                    <span className="font-medium">{formatDateTime(entry.createdAt)} · {entry.name} ({entry.email})</span>
                    <span className="text-text-2 whitespace-pre-line">{entry.items ? `Dotyczy: ${entry.items}` : 'Dotyczy całego zamówienia'}</span>
                    {entry.note && <span className="text-text-2 whitespace-pre-line">Uwagi: {entry.note}</span>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {order.notes && (
            <Card className="flex flex-col">
              <CardHeader icon={StickyNote} title="Uwagi klienta" />
              <p className="m-0 px-4 pt-3 pb-4 text-xs whitespace-pre-line text-text">{order.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
