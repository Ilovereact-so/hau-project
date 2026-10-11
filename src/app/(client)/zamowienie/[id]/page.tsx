import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { getGuestOrderDetail } from '@/actions/orders'
import { absoluteUrl } from '@/lib/site'
import { guestOrderPath } from '@/lib/orderAccess'
import Content from '../../profile/orders/[id]/Content'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Twoje zamówienie', robots: { index: false, follow: false } }

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Zamówienie złożone BEZ logowania. Dostęp: ta sama przeglądarka (ciasteczko
 * `guest_id`) albo podpisany link `?t=` (lib/orderAccess.ts). Zalogowany
 * właściciel trafia do swojego profilu.
 */
export default async function GuestOrderPage({ params, searchParams }: Props) {
  const { id } = await params
  const search = await searchParams
  const token = typeof search.t === 'string' ? search.t : null
  const payment = typeof search.payment === 'string' ? search.payment : null

  const data = await getGuestOrderDetail(id, token)
  if (!data) notFound()

  const { userId } = await auth()
  if (userId && data.order.userId === userId) {
    redirect(`/profile/orders/${id}${payment ? `?payment=${encodeURIComponent(payment)}` : ''}`)
  }

  return (
    <div className='xl:px-15 lg:px-13 px-6 pb-16 max-w-[1500px] mx-auto w-full'>
      <Content data={data} variant='guest' payment={payment} guestLink={absoluteUrl(guestOrderPath(id))} accessToken={token} />
    </div>
  )
}
