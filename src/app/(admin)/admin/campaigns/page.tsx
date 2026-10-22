import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin/guard'
import { ErrorBox } from '@/components/admin/kit/EmptyState'
import { CampaignsView } from '@/components/admin/marketing/campaigns/CampaignsView'
import { audienceSize, listCampaigns, sendingUsage } from '@/lib/campaigns/campaigns.server'
import { isMailConfigured } from '@/lib/mail'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kampanie' }

export default async function AdminCampaignsPage() {
  await requireAdmin()
  try {
    const [campaigns, audience, usage] = await Promise.all([listCampaigns(), audienceSize(), sendingUsage()])
    return <CampaignsView campaigns={campaigns} audience={audience} usage={usage} smtpConfigured={isMailConfigured()} />
  } catch (err) {
    console.error('[admin/campaigns]', err)
    return (
      <ErrorBox>
        Nie udało się wczytać kampanii z bazy. Jeśli to pierwsze uruchomienie po aktualizacji — wykonaj migrację
        drizzle/0005_newsletter_campaigns.sql. ({(err as Error)?.message ?? 'nieznany błąd'})
      </ErrorBox>
    )
  }
}
