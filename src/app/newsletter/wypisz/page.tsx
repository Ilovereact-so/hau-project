import type { Metadata } from 'next'
import NewsletterActionCard from '../NewsletterActionCard'

export const metadata: Metadata = { title: 'Wypisz się z newslettera' }

export default async function UnsubscribeNewsletterPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams
  return <NewsletterActionCard mode="unsubscribe" token={typeof token === 'string' ? token : ''} />
}
