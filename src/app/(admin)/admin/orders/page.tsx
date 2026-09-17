import type { Metadata } from 'next'
import { getAdminOrders } from '@/lib/admin/ordersQueries'
import { OrdersView } from '@/components/admin/orders/OrdersView'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Zamówienia' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const get = (key: string) => {
    const value = sp[key]
    return (Array.isArray(value) ? value[0] : value) ?? ''
  }
  const page = Math.max(Number.parseInt(get('page') || '1', 10) || 1, 1)
  const days = Number.parseInt(get('days'), 10)

  const data = await getAdminOrders({
    status: get('status') || undefined,
    method: get('method') || undefined,
    q: get('q') || undefined,
    from: get('from') || undefined,
    to: get('to') || undefined,
    days: Number.isFinite(days) ? days : undefined,
    sort: get('sort') === 'value' ? 'value' : 'date',
    page,
  })

  return <OrdersView rows={data.rows} total={data.total} page={data.page} limit={data.limit} />
}
