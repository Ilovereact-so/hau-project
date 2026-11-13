import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin/guard'
import { getMenuEditorData } from '@/lib/admin/menu'
import { ErrorBox } from '@/components/admin/kit/EmptyState'
import { MenuEditor } from '@/components/admin/menu/MenuEditor'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Menu sklepu' }

export default async function AdminMenuPage() {
  await requireAdmin()
  try {
    const data = await getMenuEditorData()
    return <MenuEditor initial={data} />
  } catch (err) {
    console.error('[admin/menu]', err)
    return <ErrorBox>Nie udało się wczytać kategorii z Sanity: {(err as Error)?.message ?? 'nieznany błąd'}</ErrorBox>
  }
}
