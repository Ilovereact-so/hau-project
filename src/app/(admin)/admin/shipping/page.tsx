import type { Metadata } from 'next'
import { gte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { deliveryServices, orders } from '@/db/schema'
import { listShippingMethods, type AdminShippingMethod } from '@/lib/admin/catalog'
import { ShippingView, type FurgonetkaServiceRow } from '@/components/admin/shipping/ShippingView'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Dostawy' }

export default async function AdminShippingPage() {
  const d30 = new Date(Date.now() - 30 * 86400_000)
  const [methodsResult, usageResult, servicesResult] = await Promise.allSettled([
    listShippingMethods(),
    db
      .select({ method: orders.shippingMethod, count: sql<number>`COUNT(*)` })
      .from(orders)
      .where(gte(orders.createdAt, d30))
      .groupBy(orders.shippingMethod),
    db
      .select({
        id: deliveryServices.id,
        serviceCode: deliveryServices.serviceCode,
        name: deliveryServices.name,
        deliveryType: deliveryServices.deliveryType,
        priceCents: deliveryServices.priceCents,
        isActive: deliveryServices.isActive,
      })
      .from(deliveryServices)
      .orderBy(deliveryServices.sortOrder, deliveryServices.name),
  ])

  const methods: AdminShippingMethod[] = methodsResult.status === 'fulfilled' ? methodsResult.value : []
  const usage =
    usageResult.status === 'fulfilled'
      ? Object.fromEntries(usageResult.value.map((row) => [row.method, Number(row.count)]))
      : {}
  const services: FurgonetkaServiceRow[] = servicesResult.status === 'fulfilled' ? servicesResult.value : []

  return (
    <ShippingView
      methods={methods}
      usage={usage}
      services={services}
      loadError={
        methodsResult.status === 'rejected'
          ? `Nie udało się pobrać metod dostawy z Sanity: ${(methodsResult.reason as Error)?.message}`
          : undefined
      }
    />
  )
}
