import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin/guard'
import { listGuideCategories, type AdminGuideCategory } from '@/lib/admin/guides'
import { GuideCategoriesView } from '@/components/admin/blog/GuideCategoriesView'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kategorie bloga' }

export default async function GuideCategoriesPage() {
  await requireAdmin()
  let categories: AdminGuideCategory[] = []
  let loadError: string | undefined
  try {
    categories = await listGuideCategories()
  } catch (error) {
    loadError = `Nie udało się pobrać kategorii z Sanity: ${(error as Error)?.message ?? 'nieznany błąd'}`
  }
  return <GuideCategoriesView categories={categories} loadError={loadError} />
}
