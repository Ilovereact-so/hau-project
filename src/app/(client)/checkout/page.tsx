import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getSavedAddress } from '@/actions/address'
import { getShippingMethods } from '@/sanity/helpers'
import ServerUser from '@/components/ServerUser'
import CheckoutClient from './CheckoutClient'

export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/checkout')

  const [services, savedAddress] = await Promise.all([
    getShippingMethods(),
    getSavedAddress(),
  ])

  return (
    <CheckoutClient
      services={services}
      savedAddress={savedAddress}
      userSlot={<ServerUser mode={1} />}
    />
  )
}
