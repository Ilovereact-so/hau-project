import type { Metadata } from 'next'
import { listAdminCategories } from '@/lib/admin/catalog'
import { CategoriesView } from '@/components/admin/categories/CategoriesView'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kategorie' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AdminCategoriesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? ''
  try {
    const { categories, orphans } = await listAdminCategories()
    return <CategoriesView categories={categories} orphans={orphans} query={q} />
  } catch (error) {
    return (
      <CategoriesView
        categories={[]}
        orphans={[]}
        query={q}
        loadError={`Nie udało się pobrać kategorii z Sanity: ${(error as Error).message}`}
      />
    )
  }
}
