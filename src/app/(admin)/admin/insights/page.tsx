import type { Metadata } from 'next'
import { CalendarDays, Clock, Heart, ShoppingCart, TrendingUp, Wallet } from 'lucide-react'
import { getInsights } from '@/lib/admin/ordersQueries'
import { adminGetProductNames } from '@/actions/adminInsights'
import { Card, CardHeader } from '@/components/admin/kit/Card'
import { DataTable, Td, Th, Tr } from '@/components/admin/kit/DataTable'
import { StatCard } from '@/components/admin/kit/StatCard'
import { changePct, formatCents, formatCentsPrecise, formatDateTime } from '@/components/admin/kit/format'
import { BarList, ColumnChart } from '@/components/admin/charts'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Analityka' }

const DOW_LABELS = ['', 'Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb']
const DOW_ORDER = [2, 3, 4, 5, 6, 7, 1] // od poniedziałku

function delta(pct: number | null) {
  if (pct === null) return { text: 'brak porównania', tone: 'neutral' as const }
  return { text: `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toLocaleString('pl-PL')}% vs poprz. miesiąc`, tone: pct >= 0 ? ('up' as const) : ('down' as const) }
}

export default async function AdminInsightsPage() {
  const insights = await getInsights()
  const names = await adminGetProductNames(insights.wishlistTop.map((row) => row.productId)).catch(() => ({} as Record<string, string>))

  const { current, previous, previousFull } = insights.monthCompare
  const revenue = delta(changePct(current.revenueCents, previous.revenueCents))
  const count = delta(changePct(current.count, previous.count))

  const hourMap = new Map(insights.byHour.map((row) => [row.hour, row.count]))
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    label: String(hour),
    value: hourMap.get(hour) ?? 0,
    showLabel: hour % 3 === 0,
  }))
  const dowMap = new Map(insights.byDow.map((row) => [row.dow, row.count]))
  const days = DOW_ORDER.map((dow) => ({ label: DOW_LABELS[dow], value: dowMap.get(dow) ?? 0 }))

  return (
    <section className="flex flex-col gap-4 animate-fade-in">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Przychód — ten miesiąc" value={formatCents(current.revenueCents)} delta={revenue.text} tone={revenue.tone} />
        <StatCard icon={TrendingUp} label="Poprzedni miesiąc (cały)" value={formatCents(previousFull.revenueCents)} delta={`${formatCents(previous.revenueCents)} do tego dnia`} />
        <StatCard icon={CalendarDays} label="Zamówienia — ten miesiąc" value={String(current.count).padStart(2, '0')} delta={count.text} tone={count.tone} />
        <StatCard icon={CalendarDays} label="Zamówienia — poprzedni" value={String(previousFull.count).padStart(2, '0')} delta={`${previous.count} do tego dnia`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader icon={Clock} title="Zamówienia wg godziny" subtitle="Ostatnie 30 dni — kiedy klienci kupują." />
          <div className="px-4 pt-4 pb-4">
            <ColumnChart columns={hours} unit=" zam." />
          </div>
        </Card>
        <Card>
          <CardHeader icon={CalendarDays} title="Zamówienia wg dnia tygodnia" subtitle="Ostatnie 30 dni." />
          <div className="px-4 pt-4 pb-4">
            <BarList rows={days} />
          </div>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader icon={Heart} title="Najczęściej na liście życzeń" subtitle="Produkty, które klienci zapisują — kandydaci do promocji." />
          <div className="px-4 pt-4 pb-4">
            <BarList
              rows={insights.wishlistTop.map((row) => ({ label: names[row.productId] ?? row.productId, value: row.count }))}
              empty="Nikt jeszcze nic nie dodał do listy życzeń."
              prefix="♥ "
            />
          </div>
        </Card>
        <Card>
          <CardHeader icon={ShoppingCart} title="Aktywne koszyki" subtitle="Ostatnio zmieniane koszyki bez złożonego zamówienia." />
          <div className="px-4 pt-3 pb-4">
            {insights.abandonedCarts.length ? (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {insights.abandonedCarts.map((cart) => (
                  <li key={cart.ownerId} className="flex items-center gap-3 rounded-xs border border-border bg-surface px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-xs font-medium text-text">
                        {cart.ownerId.startsWith('user_') ? `Klient ${cart.ownerId.slice(5, 13)}…` : `Gość ${cart.ownerId.slice(0, 8)}…`}
                      </strong>
                      <span className="block text-[11px] text-text-2">ostatnia zmiana {formatDateTime(cart.lastAdded)}</span>
                    </span>
                    <b className="text-xs font-semibold text-text">
                      {cart.items} szt. · {cart.lines} poz.
                    </b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-sm text-text-2">Brak aktywnych koszyków.</p>
            )}
          </div>
        </Card>
      </div>

      <Card className="mb-2">
        <CardHeader icon={TrendingUp} title="Najlepiej sprzedające się produkty" subtitle="Opłacone zamówienia z ostatnich 30 dni." />
        <div className="px-4 pt-3 pb-4">
          {insights.productSales.length ? (
            <DataTable>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Produkt</Th>
                  <Th className="text-right">Sztuk</Th>
                  <Th className="text-right">Przychód</Th>
                </tr>
              </thead>
              <tbody>
                {insights.productSales.map((product, index) => (
                  <Tr key={`${product.productId}-${product.name}`}>
                    <Td className="text-text-2">{index + 1}</Td>
                    <Td className="max-w-[420px] truncate font-medium">{product.name}</Td>
                    <Td className="text-right">{product.qty}</Td>
                    <Td className="text-right font-medium whitespace-nowrap">{formatCentsPrecise(product.revenueCents)}</Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <p className="m-0 text-sm text-text-2">Brak sprzedaży w tym okresie.</p>
          )}
        </div>
      </Card>
    </section>
  )
}
