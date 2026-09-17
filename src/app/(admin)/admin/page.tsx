import type { Metadata } from 'next'
import { getDashboardStats } from '@/lib/admin/dashboardQueries'
import { DashboardView } from '@/components/admin/dashboard/DashboardView'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Dashboard' }

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats()
  return <DashboardView data={stats} />
}
