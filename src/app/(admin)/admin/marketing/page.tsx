import type { Metadata } from 'next'
import { MailCheck, MailX, UserPlus } from 'lucide-react'
import { getNewsletterStats } from '@/lib/admin/ordersQueries'
import { DEFAULT_NEWSLETTER_WELCOME, NEWSLETTER_WELCOME_KEY, getEmailTemplate } from '@/lib/emailTemplates'
import { requireAdmin } from '@/lib/admin/guard'
import { StatCard } from '@/components/admin/kit/StatCard'
import { ErrorBox } from '@/components/admin/kit/EmptyState'
import { NewsletterTemplateEditor } from '@/components/admin/marketing/NewsletterTemplateEditor'
import { SubscribersCard } from '@/components/admin/marketing/SubscribersCard'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Marketing' }

export default async function AdminMarketingPage() {
  await requireAdmin()
  const [statsResult, templateResult] = await Promise.allSettled([
    getNewsletterStats(),
    getEmailTemplate(NEWSLETTER_WELCOME_KEY),
  ])
  const stats = statsResult.status === 'fulfilled' ? statsResult.value : null
  const template = templateResult.status === 'fulfilled' ? templateResult.value : DEFAULT_NEWSLETTER_WELCOME

  return (
    <section className="flex flex-col gap-4 animate-fade-in">
      {!stats && <ErrorBox>Nie udało się pobrać subskrybentów z bazy.</ErrorBox>}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={MailCheck} label="Aktywni subskrybenci" value={String(stats?.active ?? 0)} delta="zgoda RODO zapisana" tone="up" />
        <StatCard icon={UserPlus} label="Nowi (30 dni)" value={String(stats?.last30 ?? 0)} delta="zapisy z formularza w stopce" />
        <StatCard icon={MailX} label="Wypisani" value={String(stats?.inactive ?? 0)} delta="historia zgody zostaje" />
      </div>

      <NewsletterTemplateEditor
        initial={template}
        defaults={{ subject: DEFAULT_NEWSLETTER_WELCOME.subject, html: DEFAULT_NEWSLETTER_WELCOME.html }}
      />

      <SubscribersCard subscribers={stats?.recent ?? []} />
    </section>
  )
}
