import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ExportOrdersCsv from '@/components/admin/ExportOrdersCsv'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Eksport zamówień' }

export default function AdminOrdersExportPage() {
  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <Link href="/admin/orders" className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-text-2 hover:text-text">
        <ArrowLeft size={14} strokeWidth={1.5} />
        Wszystkie zamówienia
      </Link>
      <ExportOrdersCsv />
    </div>
  )
}
