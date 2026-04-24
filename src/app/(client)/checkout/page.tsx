import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getActiveDeliveryServices } from '@/actions/deliveryServices'
import { getSavedAddress } from '@/actions/address'
import CheckoutClient from './CheckoutClient'
import { getShippingMethods } from '@/sanity/helpers'

export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/checkout')

  const [services, savedAddress] = await Promise.all([
    getShippingMethods(),
    getSavedAddress(),
  ])

  return <CheckoutClient services={services} savedAddress={savedAddress} />
}
