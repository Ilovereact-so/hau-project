import { notFound } from 'next/navigation'
import { getOrderDetail } from '@/actions/orders'
import Content from './Content'
import { requireUser } from '@/lib/requireUser'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

// Middleware pilnuje logowania na /profile(.*), więc tu wystarczy sprawdzić,
// czy zamówienie należy do zalogowanego użytkownika (robi to getOrderDetail).
export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params
  await requireUser(`/profile/orders/${encodeURIComponent(id)}`)

  const data = await getOrderDetail(id)
  if (!data) notFound()

  return <Content data={data} />
}
