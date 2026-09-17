import type { Metadata } from 'next'
import { AlertTriangle, CheckCircle2, Clock3, WalletCards } from 'lucide-react'
import { getAdminPayments } from '@/lib/admin/ordersQueries'
import { StatCard } from '@/components/admin/kit/StatCard'
import { formatCents } from '@/components/admin/kit/format'
import { PaymentsTable } from '@/components/admin/payments/PaymentsTable'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Płatności' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AdminPaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const get = (key: string) => ((Array.isArray(sp[key]) ? sp[key]![0] : sp[key]) as string | undefined) ?? ''
  const page = Math.max(Number.parseInt(get('page') || '1', 10) || 1, 1)

  const data = await getAdminPayments({
    status: get('status') || undefined,
    provider: get('provider') || undefined,
    page,
  })
  const s = data.summary30
  const total = Object.values(s).reduce((sum, entry) => sum + entry.count, 0)
  const successRate = total ? Math.round(((s.success?.count ?? 0) / total) * 1000) / 10 : null

  return (
    <section className="flex flex-col gap-4 animate-fade-in">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CheckCircle2}
          label="Zaksięgowane (30 dni)"
          value={formatCents(s.success?.amountCents ?? 0)}
          delta={`${s.success?.count ?? 0} transakcji`}
          tone="up"
          href="/admin/payments?status=success"
        />
        <StatCard
          icon={Clock3}
          label="Oczekujące (30 dni)"
          value={String(s.pending?.count ?? 0)}
          unit="transakcji"
          delta={formatCents(s.pending?.amountCents ?? 0)}
          href="/admin/payments?status=pending"
        />
        <StatCard
          icon={AlertTriangle}
          label="Nieudane (30 dni)"
          value={String(s.failed?.count ?? 0)}
          unit="transakcji"
          delta={s.expired?.count ? `+ ${s.expired.count} wygasłych` : 'brak wygasłych'}
          tone={(s.failed?.count ?? 0) > 0 ? 'down' : 'neutral'}
          href="/admin/payments?status=failed"
        />
        <StatCard
          icon={WalletCards}
          label="Skuteczność płatności"
          value={successRate === null ? '—' : `${successRate.toLocaleString('pl-PL')}%`}
          delta={`${total} prób w 30 dni`}
          tone={successRate !== null && successRate < 70 ? 'down' : 'neutral'}
        />
      </div>

      <PaymentsTable rows={data.rows} total={data.total} page={data.page} limit={data.limit} />
    </section>
  )
}
