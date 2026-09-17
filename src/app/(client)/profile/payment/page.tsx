import React from 'react'
import Content from './Content'
import { getMySavedCards } from '@/actions/savedCards'
import { requireUser } from '@/lib/requireUser'

export const dynamic = 'force-dynamic'

const page = async () => {
  await requireUser('/profile/payment')
  const cards = await getMySavedCards()
  const recurringEnabled = process.env.AUTOPAY_RECURRING_ENABLED === 'true'

  return <Content cards={cards} recurringEnabled={recurringEnabled} />
}

export default page
