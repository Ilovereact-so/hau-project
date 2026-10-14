import { notFound } from 'next/navigation'
import { getOrderDetail } from '@/actions/orders'
import Content from './Content'
import { requireUser } from '@/lib/requireUser'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Szczegóły zamówienia' }

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// Middleware pilnuje logowania na /profile(.*), więc tu wystarczy sprawdzić,
// czy zamówienie należy do zalogowanego użytkownika (robi to getOrderDetail).
export default async function OrderDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const payment = (await searchParams).payment
  await requireUser(`/profile/orders/${encodeURIComponent(id)}`)

  const data = await getOrderDetail(id)
  if (!data) notFound()

  return <Content data={data} payment={typeof payment === 'string' ? payment : null} />
}
