import type { Metadata } from 'next'
import { EyeOff, MessageSquareText, Sparkles, ThumbsDown } from 'lucide-react'
import { getAdminReviewStats, getAdminReviews, type AdminReviewStats } from '@/lib/admin/reviewsQueries'
import { requireAdmin } from '@/lib/admin/guard'
import { StatCard } from '@/components/admin/kit/StatCard'
import { ReviewsView } from '@/components/admin/reviews/ReviewsView'
import { formatAverage } from '@/lib/reviewsShared'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Opinie' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const EMPTY_STATS: AdminReviewStats = { total: 0, published: 0, hidden: 0, last7: 0, average: 0, lowRated30: 0 }

export default async function AdminReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin()
  const sp = await searchParams
  const get = (key: string) => {
    const value = sp[key]
    return (Array.isArray(value) ? value[0] : value) ?? ''
  }
  const page = Math.max(Number.parseInt(get('page') || '1', 10) || 1, 1)

  const [listResult, statsResult] = await Promise.allSettled([
    getAdminReviews({
      status: get('status') || undefined,
      rating: get('rating') || undefined,
      q: get('q') || undefined,
      page,
    }),
    getAdminReviewStats(),
  ])

  const list = listResult.status === 'fulfilled' ? listResult.value : { rows: [], total: 0, page, limit: 20 }
  const stats = statsResult.status === 'fulfilled' ? statsResult.value : EMPTY_STATS
  const error =
    listResult.status === 'rejected'
      ? `Nie udało się pobrać opinii: ${(listResult.reason as Error)?.message ?? 'błąd bazy'}. Czy migracja 0011_product_reviews została uruchomiona?`
      : undefined

  return (
    <section className="flex flex-col gap-4 animate-fade-in">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={MessageSquareText}
          label="Średnia ocena"
          value={stats.published ? formatAverage(stats.average) : '—'}
          unit="/ 5"
          delta={`${stats.published} opublikowanych`}
          href="/admin/reviews?status=published"
        />
        <StatCard
          icon={Sparkles}
          label="Nowe (7 dni)"
          value={String(stats.last7)}
          unit="opinii"
          delta={`${stats.total} łącznie`}
          tone={stats.last7 ? 'up' : 'neutral'}
        />
        <StatCard
          icon={ThumbsDown}
          label="Niskie oceny (30 dni)"
          value={String(stats.lowRated30)}
          unit="opinii"
          delta="ocena 1–2 — warto odpowiedzieć"
          tone={stats.lowRated30 ? 'down' : 'neutral'}
          href="/admin/reviews?rating=1"
        />
        <StatCard
          icon={EyeOff}
          label="Ukryte"
          value={String(stats.hidden)}
          unit="opinii"
          delta="nie liczą się do średniej"
          href="/admin/reviews?status=hidden"
        />
      </div>

      <ReviewsView rows={list.rows} total={list.total} page={list.page} limit={list.limit} error={error} />
    </section>
  )
}
