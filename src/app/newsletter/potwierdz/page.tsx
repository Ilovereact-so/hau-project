import type { Metadata } from 'next'
import NewsletterActionCard from '../NewsletterActionCard'

export const metadata: Metadata = { title: 'Potwierdź zapis do newslettera' }

export default async function ConfirmNewsletterPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams
  return <NewsletterActionCard mode="confirm" token={typeof token === 'string' ? token : ''} />
}
