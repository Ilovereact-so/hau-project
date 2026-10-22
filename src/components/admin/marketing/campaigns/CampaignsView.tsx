'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Copy, Mail, MailCheck, Megaphone, Plus, Send, Trash2, Users } from 'lucide-react'
import type { AdminCampaign } from '@/lib/campaigns/campaigns.server'
import { CAMPAIGN_STATUS_LABELS } from '@/lib/campaigns/content'
import { adminCreateCampaign, adminDeleteCampaign, adminDuplicateCampaign } from '@/actions/adminCampaigns'
import { Badge } from '../../kit/Badge'
import { Button, IconButton } from '../../kit/Button'
import { Card, CardHeader } from '../../kit/Card'
import { DataTable, Td, Th, Tr } from '../../kit/DataTable'
import { EmptyState, ErrorBox, NoticeBox } from '../../kit/EmptyState'
import { StatCard } from '../../kit/StatCard'

const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' }).format(new Date(value))
    : '—'

const errorsWord = (n: number) =>
  n === 1 ? 'błąd' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'błędy' : 'błędów'

/** Data, która najlepiej opisuje stan kampanii. */
function campaignDate(c: AdminCampaign): string {
  if (c.status === 'scheduled') return `zaplanowana: ${dateTime(c.scheduledAt)}`
  if (c.status === 'sent' || c.status === 'cancelled') return `zakończona: ${dateTime(c.finishedAt)}`
  if (c.status === 'sending' || c.status === 'paused') return `start: ${dateTime(c.startedAt)}`
  return `utworzona: ${dateTime(c.createdAt)}`
}

export function CampaignsView({
  campaigns,
  audience,
  usage,
  smtpConfigured,
}: {
  campaigns: AdminCampaign[]
  audience: number
  usage: { day: number; dailyLimit: number; ratePerMinute: number }
  smtpConfigured: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const create = () =>
    startTransition(async () => {
      const result = await adminCreateCampaign()
      if (!result.ok) return void toast.error(result.error)
      router.push(`/admin/campaigns/${result.data}`)
    })

  const duplicate = (campaign: AdminCampaign) =>
    startTransition(async () => {
      const result = await adminDuplicateCampaign(campaign.id)
      if (!result.ok) return void toast.error(result.error)
      toast.success('Skopiowano jako nowy szkic')
      router.push(`/admin/campaigns/${result.data}`)
    })

  const remove = (campaign: AdminCampaign) => {
    const sentNote = campaign.status === 'sent' ? '\n\nWysłane maile zostaną u odbiorców — zniknie tylko historia w panelu.' : ''
    if (!window.confirm(`Usunąć kampanię „${campaign.name}”?${sentNote}`)) return
    startTransition(async () => {
      const result = await adminDeleteCampaign(campaign.id)
      if (!result.ok) return void toast.error(result.error)
      toast.success('Kampania usunięta')
      router.refresh()
    })
  }

  const sentTotal = campaigns.reduce((sum, c) => sum + c.sent, 0)
  const active = campaigns.filter((c) => c.status === 'sending' || c.status === 'scheduled' || c.status === 'paused').length

  return (
    <section className="flex flex-col gap-4 animate-fade-in">
      {!smtpConfigured && (
        <ErrorBox>
          Wysyłka maili nie jest skonfigurowana (brak SMTP_HOST w .env serwera) — kampanie można przygotować, ale nie da się ich wysłać.
        </ErrorBox>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Odbiorcy" value={String(audience)} delta="aktywni, z potwierdzonym zapisem" tone="up" href="/admin/marketing" />
        <StatCard icon={Send} label="Wysłane dziś (24 h)" value={String(usage.day)} delta={`limit ${usage.dailyLimit} na dobę`} />
        <StatCard icon={MailCheck} label="Wysłane łącznie" value={String(sentTotal)} delta="we wszystkich kampaniach" />
        <StatCard icon={Megaphone} label="W toku" value={String(active)} delta="zaplanowane, wysyłane, wstrzymane" />
      </div>

      <Card className="flex flex-col">
        <CardHeader
          icon={Mail}
          title="Kampanie newslettera"
          subtitle="Maile do subskrybentów, którzy potwierdzili zapis. Każdy mail ma link wypisania i przycisk „Anuluj subskrypcję” w Gmailu."
          actions={
            <Button size="sm" onClick={create} disabled={pending}>
              <Plus size={14} strokeWidth={2} />
              Nowa kampania
            </Button>
          }
        />
        <div className="px-4 pt-3 pb-4">
          {campaigns.length ? (
            <DataTable>
              <thead>
                <tr>
                  <Th>Kampania</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Wysłane</Th>
                  <Th>Kiedy</Th>
                  <Th className="w-[90px]">Akcje</Th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => {
                  const status = CAMPAIGN_STATUS_LABELS[campaign.status] ?? CAMPAIGN_STATUS_LABELS.draft
                  const percent = campaign.total ? Math.round((campaign.sent / campaign.total) * 100) : 0
                  return (
                    <Tr key={campaign.id} className="cursor-pointer" onClick={() => router.push(`/admin/campaigns/${campaign.id}`)}>
                      <Td className="max-w-[340px]">
                        <Link href={`/admin/campaigns/${campaign.id}`} className="block truncate font-medium text-text hover:underline" onClick={(e) => e.stopPropagation()}>
                          {campaign.name}
                        </Link>
                        <span className="block truncate text-[11px] text-text-2">{campaign.subject || 'bez tematu'}</span>
                      </Td>
                      <Td>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </Td>
                      <Td className="text-right whitespace-nowrap">
                        {campaign.total ? (
                          <span>
                            {campaign.sent} / {campaign.total}
                            <span className="ml-1 text-[11px] text-text-2">({percent}%)</span>
                            {campaign.failed > 0 && <span className="block text-[11px] text-danger">{campaign.failed} {errorsWord(campaign.failed)}</span>}
                          </span>
                        ) : (
                          <span className="text-text-2">—</span>
                        )}
                      </Td>
                      <Td className="text-xs whitespace-nowrap text-text-2">{campaignDate(campaign)}</Td>
                      <Td>
                        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <IconButton label="Kopiuj jako nowy szkic" disabled={pending} onClick={() => duplicate(campaign)}>
                            <Copy size={14} strokeWidth={1.5} />
                          </IconButton>
                          <IconButton
                            label="Usuń kampanię"
                            className="text-danger hover:border-danger/50 hover:text-danger"
                            disabled={pending || campaign.status === 'sending'}
                            onClick={() => remove(campaign)}
                          >
                            <Trash2 size={14} strokeWidth={1.5} />
                          </IconButton>
                        </div>
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </DataTable>
          ) : (
            <EmptyState icon={<Megaphone size={20} strokeWidth={1.5} />} title="Nie ma jeszcze kampanii">
              Kliknij „Nowa kampania”, napisz maila (tekst, zdjęcie, przycisk, produkty, kod rabatowy), wyślij test do siebie i dopiero wtedy do subskrybentów.
            </EmptyState>
          )}
          <NoticeBox className="mt-3">
            Maile wychodzą partiami: najwyżej {usage.ratePerMinute} na minutę i {usage.dailyLimit} na dobę (limity skrzynki pocztowej —
            zmienia się je w .env: NEWSLETTER_RATE_PER_MINUTE, NEWSLETTER_DAILY_LIMIT). Wysyłka trwa, gdy panel kampanii jest otwarty, a przy
            zamkniętym — dzięki zadaniu cyklicznemu /api/cron/newsletter-campaigns (ustaw je na hostingu co 5–10 minut).
          </NoticeBox>
        </div>
      </Card>
    </section>
  )
}
