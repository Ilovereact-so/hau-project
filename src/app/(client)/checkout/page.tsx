import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getAvailableServices } from '@/lib/furgonetka'
import CheckoutClient from './CheckoutClient'

export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/checkout')

  let services: Awaited<ReturnType<typeof getAvailableServices>> = []
  try {
    services = await getAvailableServices()
  } catch {
    // render with empty services — client shows error state
  }

  return <CheckoutClient shippingServices={services} />
}
