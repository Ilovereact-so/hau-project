import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { requireAdmin } from '@/lib/admin/guard'
import { ErrorBox } from '@/components/admin/kit/EmptyState'
import { CampaignEditor } from '@/components/admin/marketing/campaigns/CampaignEditor'
import { audienceSize, getCampaign, sendingUsage } from '@/lib/campaigns/campaigns.server'
import { listAdminProducts } from '@/lib/admin/catalog'
import { isMailConfigured } from '@/lib/mail'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kampania' }

export default async function AdminCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  try {
    const [campaign, audience, usage, products, user] = await Promise.all([
      getCampaign(id),
      audienceSize(),
      sendingUsage(),
      listAdminProducts().catch(() => []),
      currentUser().catch(() => null),
    ])
    if (!campaign) notFound()
    return (
      <CampaignEditor
        key={`${campaign.id}:${campaign.status}`}
        campaign={campaign}
        audience={audience}
        usage={usage}
        smtpConfigured={isMailConfigured()}
        adminEmail={user?.primaryEmailAddress?.emailAddress ?? ''}
        products={products.map((p) => ({
          id: p.id,
          title: p.title,
          sku: p.sku,
          imageUrl: p.images[0]?.url ?? null,
          status: p.status,
          isFeatured: p.isFeatured,
          isBestseller: p.isBestseller,
          price: p.price,
        }))}
      />
    )
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith('NEXT_')) throw err
    console.error('[admin/campaigns/id]', err)
    return <ErrorBox>Nie udało się wczytać kampanii: {(err as Error)?.message ?? 'nieznany błąd'}</ErrorBox>
  }
}
