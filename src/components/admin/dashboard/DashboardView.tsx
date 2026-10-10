'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CalendarClock,
  Clock3,
  Filter,
  Hammer,
  PackageCheck,
  PackageOpen,
  Percent,
  PieChart,
  RefreshCw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
  Wallet,
} from 'lucide-react'
import type { DashboardStats } from '@/lib/admin/dashboardQueries'
import {
  OrderStatusLabel, PaymentMethodLabel, PaymentProviderLabel, PaymentTxLabel, ShipmentStatusLabel,
} from '@/lib/admin/labels'
import { ActionTray, Card, CardHeader, SectionHeader, Tally } from '../kit/Card'
import { StatCard } from '../kit/StatCard'
import { IconButton, IconLink } from '../kit/Button'
import { PillButton, PillSelect } from '../kit/Pill'
import { SparkBars, SparkDots, SparkLine, SparkWave } from '../kit/Spark'
import { Badge, Dot, ORDER_STATUS_TONES, toneFor, type BadgeTone } from '../kit/Badge'
import { formatCents, formatCentsPrecise, formatDate, formatDateTime, orderNumber } from '../kit/format'
import { RevenueChart, DonutChart } from '../charts'
import { QuickActions } from './QuickActions'

type Delta = { text: string; tone: 'up' | 'down' | 'neutral' }

function deltaFor(pct: number | null): Delta | undefined {
  if (pct === null) return undefined
  return {
    text: `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toLocaleString('pl-PL')}%`,
    tone: pct >= 0 ? 'up' : 'down',
  }
}

const DOT_TONES: BadgeTone[] = ['primary', 'info', 'purple', 'success']

export function DashboardView({ data }: { data: DashboardStats }) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const [period, setPeriod] = useState('30')
  const [tableQuery, setTableQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [sort, setSort] = useState<'date' | 'value'>('date')

  const revenueDelta = deltaFor(data.revenueChangePct)
  const ordersDelta = deltaFor(data.orderCountChangePct)
  const revenueSeries = data.daily.map((entry) => entry.revenue)
  const countSeries = data.daily.map((entry) => entry.count)
  const recent = data.recentOrders[0]
  const recentLabel = recent
    ? `${orderNumber(recent.id)} — ${recent.itemSummary || 'zamówienie'}`
    : 'brak zamówień'

  const rows = useMemo(() => {
    const needle = tableQuery.trim().toLowerCase()
    const filtered = needle
      ? data.recentOrders.filter((order) =>
          `${orderNumber(order.id)} ${order.itemSummary} ${order.customer} ${OrderStatusLabel[order.status] ?? order.status}`
            .toLowerCase()
            .includes(needle)
        )
      : data.recentOrders
    return [...filtered]
      .sort((a, b) =>
        sort === 'value'
          ? b.totalCents - a.totalCents
          : new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      )
      .slice(0, 6)
  }, [data.recentOrders, tableQuery, sort])

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* ── Highlights ──────────────────────────────────────── */}
      <SectionHeader
        title="Podsumowanie"
        actions={
          <PillButton icon={RefreshCw} onClick={() => startRefresh(() => router.refresh())} disabled={refreshing}>
            {refreshing ? 'Odświeżam…' : 'Odśwież dane'}
          </PillButton>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Przychód (30 dni)"
          value={formatCents(data.revenueCents)}
          delta={revenueDelta?.text ?? 'brak porównania'}
          tone={revenueDelta?.tone}
          chart={<SparkBars values={revenueSeries} />}
        />
        <StatCard
          icon={ShoppingBag}
          label="Zamówienia (30 dni)"
          value={String(data.orderCount).padStart(2, '0')}
          delta={ordersDelta?.text ?? 'brak porównania'}
          tone={ordersDelta?.tone}
          chart={<SparkLine values={countSeries} />}
          href="/admin/orders"
        />
        <StatCard
          icon={PackageOpen}
          label="Produkty w sklepie"
          value={data.catalog ? String(data.catalog.published).padStart(2, '0') : '—'}
          unit={data.catalog ? `z ${data.catalog.total}` : undefined}
          delta={
            !data.catalog
              ? 'Sanity niedostępne'
              : data.catalog.drafts
                ? `${data.catalog.drafts} w szkicach`
                : 'wszystko opublikowane'
          }
          tone={data.catalog ? 'neutral' : 'down'}
          chart={<SparkWave values={revenueSeries} />}
          href="/admin/products"
        />
        <StatCard
          icon={Hammer}
          label="W realizacji"
          value={String(data.inProgress).padStart(2, '0')}
          unit="zamówień"
          delta={data.toShipQueue.length ? `${data.toShipQueue.length}${data.toShipQueue.length >= 5 ? '+' : ''} do nadania` : 'nic do nadania'}
          chart={<SparkDots filled={Math.min(4, Math.max(0, data.inProgress))} />}
          href="/admin/orders?status=processing"
        />
      </div>

      {/* ── Sprzedaż w liczbach ──────────────────────────────── */}
      <SectionHeader title="Sprzedaż w liczbach" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={BarChart3}
          label="Średnia wartość zamówienia"
          value={formatCents(data.averageOrderCents)}
          delta={`${data.orderCount} zamówień`}
        />
        <StatCard
          icon={Wallet}
          label="Zainkasowano online"
          value={formatCents(data.capturedCents)}
          delta={
            data.codOutstandingCents
              ? `${formatCents(data.codOutstandingCents)} w pobraniach`
              : 'bez pobrań w drodze'
          }
          tone={data.codOutstandingCents ? 'down' : 'up'}
          href="/admin/payments"
        />
        <StatCard
          icon={Truck}
          label="Przychód z dostaw"
          value={formatCents(data.shippingRevenueCents)}
          delta="w cenie zamówień"
        />
        <StatCard
          icon={Percent}
          label="Koszyk → zamówienie"
          value={
            data.cartConversionPct === null ? '—' : `${data.cartConversionPct.toLocaleString('pl-PL')}%`
          }
          delta={`${data.openCarts} koszyków`}
          href="/admin/insights"
        />
      </div>

      {/* ── Wykres przychodów + podział statusów ─────────────── */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="flex min-w-0 flex-col">
          <CardHeader
            title="Przegląd przychodów"
            subtitle="Sprzedaż opłaconych zamówień dzień po dniu (bez anulowanych i zwróconych)."
            actions={
              <ActionTray>
                <PillSelect
                  label="Okres"
                  value={period}
                  onChange={setPeriod}
                  options={[
                    { value: '30', label: 'Ostatnie 30 dni' },
                    { value: '14', label: 'Ostatnie 14 dni' },
                    { value: '7', label: 'Ostatnie 7 dni' },
                  ]}
                />
              </ActionTray>
            }
          />
          <div className="px-2 pb-3">
            <RevenueChart daily={data.daily.slice(-Number(period))} />
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader
            icon={PieChart}
            title="Podział zamówień"
            subtitle="Statusy zamówień z ostatnich 30 dni."
            actions={
              <ActionTray>
                <IconLink label="Szukaj zamówienia" href="/admin/orders">
                  <Search size={14} strokeWidth={1.5} />
                </IconLink>
                <IconLink label="Przejdź do zamówień" href="/admin/orders">
                  <ArrowUpRight size={14} strokeWidth={1.5} />
                </IconLink>
              </ActionTray>
            }
          />
          <div className="px-4 pb-4">
            <DonutChart values={data.statuses} labels={OrderStatusLabel} />
          </div>
        </Card>
      </div>

      {/* ── Tabela zamówień + szybkie akcje ──────────────────── */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="flex min-w-0 flex-col">
          <CardHeader
            icon={CalendarClock}
            title="Najnowsze zamówienia"
            actions={
              <ActionTray>
                {searchOpen ? (
                  <input
                    autoFocus
                    value={tableQuery}
                    onChange={(event) => setTableQuery(event.target.value)}
                    onBlur={() => !tableQuery && setSearchOpen(false)}
                    placeholder="Filtruj zamówienia…"
                    className="h-8 w-40 rounded-xs border border-border bg-surface px-2.5 text-xs text-text outline-none placeholder:text-muted focus:ring-2 focus:ring-primary/25"
                  />
                ) : (
                  <IconButton label="Szukaj w tabeli" onClick={() => setSearchOpen(true)}>
                    <Search size={14} strokeWidth={1.5} />
                  </IconButton>
                )}
                <PillButton icon={SlidersHorizontal} onClick={() => setSort((current) => (current === 'date' ? 'value' : 'date'))}>
                  {sort === 'date' ? 'Wg daty' : 'Wg wartości'}
                </PillButton>
                <Link
                  href="/admin/orders"
                  className="inline-flex h-8 items-center gap-1.5 rounded-xs border border-border bg-bg px-2.5 text-xs font-medium text-text-2 transition-colors hover:border-border-strong hover:text-text"
                >
                  <Filter size={13} strokeWidth={1.5} />
                  Wszystkie
                </Link>
              </ActionTray>
            }
          />
          {!data.recentOrders.length ? (
            <p className="px-4 pt-3 pb-4 text-sm text-text-2">Brak zamówień.</p>
          ) : !rows.length ? (
            <p className="px-4 pt-3 pb-4 text-sm text-text-2">Żadne zamówienie nie pasuje do wyszukiwania.</p>
          ) : (
            <div className="mt-3 overflow-x-auto px-4 pb-4">
              <table className="w-full min-w-[600px] border-collapse text-xs">
                <thead>
                  <tr className="bg-surface text-text-2">
                    <MiniTh className="rounded-l-xs">Zamówienie</MiniTh>
                    <MiniTh>Pozycja</MiniTh>
                    <MiniTh>Data</MiniTh>
                    <MiniTh>Wartość</MiniTh>
                    <MiniTh className="rounded-r-xs border-r-0">Status</MiniTh>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((order, index) => (
                    <tr
                      key={order.id}
                      className="cursor-pointer transition-colors duration-150 ease-(--ease) hover:bg-surface/60"
                      onClick={() => router.push(`/admin/orders/${order.id}`)}
                    >
                      <MiniTd>
                        <Link href={`/admin/orders/${order.id}`} className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                          <Dot tone={DOT_TONES[index % DOT_TONES.length]} />
                          <span className="font-mono font-medium text-text">{orderNumber(order.id)}</span>
                        </Link>
                        <span className="mt-0.5 block truncate pl-3.5 text-[11px] text-text-2">{order.customer}</span>
                      </MiniTd>
                      <MiniTd className="max-w-[240px] truncate text-text-2">{order.itemSummary || '—'}</MiniTd>
                      <MiniTd className="whitespace-nowrap text-text-2">{formatDate(order.createdAt)}</MiniTd>
                      <MiniTd className="font-medium whitespace-nowrap text-text">{formatCentsPrecise(order.totalCents)}</MiniTd>
                      <MiniTd>
                        <Badge tone={toneFor(ORDER_STATUS_TONES, order.status)}>{OrderStatusLabel[order.status] ?? order.status}</Badge>
                      </MiniTd>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Szybkie akcje" subtitle="Wróć do pracy w dwóch kliknięciach." />
          <QuickActions recentLabel={recentLabel} recentHref={recent ? `/admin/orders/${recent.id}` : '/admin/orders'} />
        </Card>
      </div>

      {/* ── Kolejki do obsłużenia ────────────────────────────── */}
      <div className="grid gap-3 lg:grid-cols-3">
        <QueueCard
          icon={PackageCheck}
          title="Do nadania"
          subtitle="Opłacone lub w realizacji, bez przesyłki — najstarsze na górze."
          href="/admin/orders?status=paid"
          empty="Nic nie czeka na nadanie."
          items={data.toShipQueue.map((order) => ({
            id: order.id,
            href: `/admin/orders/${order.id}`,
            title: orderNumber(order.id),
            meta: `${OrderStatusLabel[order.status] ?? order.status} · ${formatDateTime(order.createdAt)}`,
            value: formatCentsPrecise(order.totalCents),
          }))}
        />
        <QueueCard
          icon={Clock3}
          title="Czekają na płatność"
          subtitle="Klient nie dokończył płatności — często wystarczy przypomnienie."
          href="/admin/orders?status=awaiting_payment"
          empty="Brak nieopłaconych zamówień."
          items={data.awaitingQueue.map((order) => ({
            id: order.id,
            href: `/admin/orders/${order.id}`,
            title: orderNumber(order.id),
            meta: `${OrderStatusLabel[order.status] ?? order.status} · ${formatDateTime(order.createdAt)}`,
            value: formatCentsPrecise(order.totalCents),
          }))}
        />
        <QueueCard
          icon={AlertTriangle}
          title="Nieudane płatności"
          subtitle="Odrzucone transakcje z bramek płatniczych."
          href="/admin/payments?status=failed"
          empty="Brak nieudanych płatności."
          tone="danger"
          items={data.failedPayments.map((payment) => ({
            id: payment.id,
            href: `/admin/orders/${payment.orderId}`,
            title: orderNumber(payment.orderId),
            meta: `${PaymentProviderLabel[payment.provider] ?? payment.provider} · ${formatDateTime(payment.createdAt)}`,
            value: formatCentsPrecise(payment.amountCents),
          }))}
        />
      </div>

      {/* ── Płatności + realizacja ───────────────────────────── */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader icon={Wallet} title="Płatności" subtitle="Stan transakcji i sposoby zapłaty (30 dni)." />
          <div className="grid gap-4 px-4 pt-3 pb-4 sm:grid-cols-2">
            <Tally
              title="Transakcje"
              rows={Object.entries(data.paymentStatuses).map(([key, count]) => ({
                label: PaymentTxLabel[key] ?? key,
                value: String(count),
              }))}
            />
            <Tally
              title="Sposób zapłaty"
              rows={data.paymentMethods.map((method) => ({
                label: PaymentMethodLabel[method.method] ?? method.method,
                value: `${method.count} · ${formatCents(method.revenueCents)}`,
              }))}
            />
          </div>
        </Card>

        <Card>
          <CardHeader icon={Truck} title="Realizacja" subtitle="Przesyłki i najczęściej kupowane produkty (30 dni)." />
          <div className="grid gap-4 px-4 pt-3 pb-4 sm:grid-cols-2">
            <Tally
              title="Przesyłki"
              rows={Object.entries(data.shipmentStatuses).map(([key, count]) => ({
                label: ShipmentStatusLabel[key] ?? key,
                value: String(count),
              }))}
            />
            <Tally
              title="Najczęściej kupowane"
              rows={data.topProducts.map((product) => ({
                label: product.name,
                value: `${product.qty} szt.`,
              }))}
            />
          </div>
        </Card>
      </div>

      {/* ── Magazyn ──────────────────────────────────────────── */}
      <Card className="mb-2">
        <CardHeader
          icon={Boxes}
          title="Stany magazynowe"
          subtitle="Produkty w sklepie z wariantami: 1 sztuka albo brak"
          actions={
            <Link href="/admin/products?filter=low" className="text-xs font-medium text-text-2 hover:text-text">
              Wszystkie →
            </Link>
          }
        />
        {data.lowStock.length ? (
          <ul className="m-0 mt-3 grid list-none gap-2 px-4 pb-4 md:grid-cols-2 xl:grid-cols-3">
            {data.lowStock.map((product) => {
              const lowest = Math.min(...product.lowStock.map((entry) => entry.stock))
              return (
                <li key={product.id}>
                  <Link
                    href={`/admin/products?q=${encodeURIComponent(product.sku || product.title)}`}
                    className="flex items-center gap-3 rounded-xs border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong"
                  >
                    <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xs border border-border bg-surface-muted text-muted">
                      {product.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`${product.images[0].url}?w=72&h=72&fit=crop`} alt="" className="size-full object-cover" />
                      ) : (
                        <Boxes size={15} strokeWidth={1.5} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-xs font-medium text-text">{product.title}</strong>
                      <span className="block truncate text-[11px] text-text-2">
                        {product.lowStock.length === 1 && product.lowStock[0].sku
                          ? `SKU: ${product.lowStock[0].sku}`
                          : `${product.lowStock.length} wariantów: 1 szt. lub brak`}
                      </span>
                    </span>
                    <b className="shrink-0 text-xs font-semibold text-danger">{lowest === 0 ? "brak" : `${lowest} szt.`}</b>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="px-4 pt-3 pb-4 text-sm text-text-2">Żaden wariant nie ma 1 sztuki ani braku towaru.</p>
        )}
      </Card>
    </div>
  )
}

function QueueCard({
  icon,
  title,
  subtitle,
  href,
  items,
  empty,
  tone,
}: {
  icon: typeof Wallet
  title: string
  subtitle: string
  href: string
  items: Array<{ id: string; href: string; title: string; meta: string; value: string }>
  empty: string
  tone?: 'danger'
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={icon}
        title={title}
        subtitle={subtitle}
        actions={
          <IconLink label={`${title} — wszystkie`} href={href}>
            <ArrowUpRight size={14} strokeWidth={1.5} />
          </IconLink>
        }
      />
      {items.length ? (
        <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 px-4 pb-4">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-xs border border-border bg-surface px-3 py-2 transition-colors hover:border-border-strong"
              >
                <span className="min-w-0 flex-1">
                  <strong className="block truncate font-mono text-xs font-medium text-text">{item.title}</strong>
                  <span className="block truncate text-[11px] text-text-2">{item.meta}</span>
                </span>
                <b className={tone === 'danger' ? 'text-xs font-semibold text-danger' : 'text-xs font-semibold text-text'}>
                  {item.value}
                </b>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 pt-3 pb-4 text-sm text-text-2">{empty}</p>
      )}
    </Card>
  )
}

function MiniTh({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <th className={`border-y border-r border-border px-3 py-2.5 text-left text-[11px] font-medium first:border-l ${className}`}>
      {children}
    </th>
  )
}

function MiniTd({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <td className={`border-b border-border px-3 py-3 align-middle ${className}`}>{children}</td>
}

