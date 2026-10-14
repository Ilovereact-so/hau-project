import { auth } from '@clerk/nextjs/server'
import { getSavedAddress } from '@/actions/address'
import { getShippingMethods } from '@/sanity/helpers'
import ServerUser from '@/components/ServerUser'
import CheckoutClient from './CheckoutClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Kasa' }

export const dynamic = 'force-dynamic'

// Kasa działa też BEZ logowania (zakup jako gość). Zalogowany dostaje
// podpowiedź zapisanego adresu i może zapamiętać kartę.
export default async function CheckoutPage() {
  const { userId } = await auth()

  const [services, savedAddress] = await Promise.all([
    getShippingMethods(),
    userId ? getSavedAddress() : Promise.resolve(null),
  ])

  return (
    <CheckoutClient
      services={services}
      savedAddress={savedAddress}
      isGuest={!userId}
      userSlot={<ServerUser mode={1} cart={true} />}
    />
  )
}
