import { getSavedAddress } from '@/actions/address'
import { requireUser } from '@/lib/requireUser'
import React from 'react'
import Content from './Content'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Moje konto' }

const page = async () => {
  await requireUser('/profile/account')
  const [savedAddress] = await Promise.all([
    getSavedAddress(),
  ])
  

  return (
    <Content savedAddress={savedAddress}/>
  )
}

export default page