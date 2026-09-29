import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin/guard'
import { listAdminGuides, listGuideCategories, type AdminGuideRow, type AdminGuideCategory } from '@/lib/admin/guides'
import { BlogListView } from '@/components/admin/blog/BlogListView'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Blog' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AdminBlogPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin()
  const sp = await searchParams
  const q = ((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? '').trim()

  const [guidesResult, categoriesResult] = await Promise.allSettled([listAdminGuides(), listGuideCategories()])
  const guides: AdminGuideRow[] = guidesResult.status === 'fulfilled' ? guidesResult.value : []
  const categories: AdminGuideCategory[] = categoriesResult.status === 'fulfilled' ? categoriesResult.value : []
  const loadError =
    guidesResult.status === 'rejected'
      ? `Nie udało się pobrać artykułów z Sanity: ${(guidesResult.reason as Error)?.message ?? 'nieznany błąd'}`
      : undefined

  return (
    <BlogListView
      // `key` = zapytanie z paska wyszukiwania u góry: nowe `q` ustawia pole od nowa.
      key={q}
      guides={guides}
      categories={categories.map((category) => ({ id: category.id, title: category.title, slug: category.slug }))}
      initialQuery={q}
      loadError={loadError}
    />
  )
}
