import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin/guard'
import { getAdminDiscounts } from '@/lib/admin/discounts'
import { ErrorBox } from '@/components/admin/kit/EmptyState'
import { DiscountCodesView } from '@/components/admin/marketing/DiscountCodesView'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kody rabatowe' }

export default async function AdminDiscountsPage() {
  await requireAdmin()
  try {
    const data = await getAdminDiscounts()
    return <DiscountCodesView data={data} />
  } catch (err) {
    console.error('[admin/discounts]', err)
    return (
      <ErrorBox>
        Nie udało się wczytać kodów rabatowych. Jeśli to pierwsze uruchomienie, wykonaj na bazie migrację{' '}
        <code>drizzle/0002_discount_codes.sql</code> (tabele <code>discount_codes</code> i{' '}
        <code>discount_redemptions</code>).
      </ErrorBox>
    )
  }
}
