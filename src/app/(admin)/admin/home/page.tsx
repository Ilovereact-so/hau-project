import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin/guard'
import { getHomeEditorData } from '@/lib/admin/homeLayout'
import { ErrorBox } from '@/components/admin/kit/EmptyState'
import { HomeLayoutEditor } from '@/components/admin/marketing/HomeLayoutEditor'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Strona główna' }

export default async function AdminHomePage() {
  await requireAdmin()
  try {
    const data = await getHomeEditorData()
    return <HomeLayoutEditor data={data} />
  } catch (err) {
    console.error('[admin/home]', err)
    return <ErrorBox>Nie udało się wczytać układu strony głównej z Sanity: {(err as Error)?.message ?? 'nieznany błąd'}</ErrorBox>
  }
}
