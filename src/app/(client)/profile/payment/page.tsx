import React from 'react'
import Content from './Content'
import { getMySavedCards } from '@/actions/savedCards'
import { requireUser } from '@/lib/requireUser'
import { AUTOPAY_RECURRING_ENABLED } from '@/lib/autopay'

export const dynamic = 'force-dynamic'

const page = async () => {
  await requireUser('/profile/payment')
  const cards = await getMySavedCards()
  return <Content cards={cards} recurringEnabled={AUTOPAY_RECURRING_ENABLED} />
}

export default page
