'use server'

import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { orders, orderItems, importJobs, shippingAddresses } from '@/db/schema'
import { eq, desc, and, sql, gte } from 'drizzle-orm'
import Papa from 'papaparse'

export async function requireAdmin() {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') throw new Error('Forbidden')
}

/**
 * Eksport zamówień do CSV (księgowość / arkusze). Kolumny płaskie: wiersz = pozycja
 * zamówienia (więc jedno zamówienie z 2 produktami daje 2 wiersze), ze wspólnymi
 * danymi nagłówka zamówienia. Kwoty w groszach przeliczamy na złotówki (2 miejsca).
 */
export async function adminExportOrdersCsv(fromDate?: string, toDate?: string) {
  await requireAdmin()

  const conds: any[] = []
  if (fromDate) {
    const d = new Date(fromDate)
    if (!isNaN(d.getTime())) conds.push(gte(orders.createdAt, d))
  }
  if (toDate) {
    const d = new Date(toDate)
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + 1)
      conds.push(sql`${orders.createdAt} < ${d}`)
    }
  }
  const where = conds.length ? and(...conds) : undefined

  const rows = await db
    .select({
      orderId: orders.id, orderStatus: orders.status, paymentMethod: orders.paymentMethod,
      shippingMethod: orders.shippingMethod, orderCreated: orders.createdAt,
      subtotalCents: orders.subtotalCents, shippingCents: orders.shippingCents,
      discountCents: orders.discountCents, totalCents: orders.totalCents,
      discountCode: orders.discountCode, guestEmail: orders.guestEmail, userId: orders.userId,
      itemName: orderItems.name, itemBrand: orderItems.brand, itemVariant: orderItems.variantLabel,
      itemVariantId: orderItems.variantId, itemProductId: orderItems.productId,
      firstName: shippingAddresses.firstName, lastName: shippingAddresses.lastName,
      addressEmail: shippingAddresses.email, phone: shippingAddresses.phone,
      itemQty: orderItems.qty, itemPriceCents: orderItems.priceCents,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .leftJoin(shippingAddresses, eq(shippingAddresses.orderId, orders.id))
    .where(where)
    .orderBy(desc(orders.createdAt))

  const gz = (cents: number | null) => Number(cents ?? 0) / 100

  const csv = Papa.unparse({
    fields: [
      'Order ID', 'Data', 'Status', 'Metoda płatności', 'Metoda dostawy',
      'Klient', 'Email', 'Telefon', 'User ID', 'Produkt', 'Marka', 'Wariant', 'ID produktu', 'ID wariantu',
      'Ilość', 'Cena jedn. (zł)', 'Wartość (zł)', 'Suma produktów (zł)',
      'Dostawa (zł)', 'Rabat (zł)', 'Łącznie (zł)', 'Kod rabatowy',
    ],
    data: rows.map(r => [
      r.orderId, r.orderCreated?.toISOString(), r.orderStatus, r.paymentMethod, r.shippingMethod,
      [r.firstName, r.lastName].filter(Boolean).join(' '), r.addressEmail ?? r.guestEmail ?? '', r.phone ?? '',
      r.userId, r.itemName, r.itemBrand, r.itemVariant, r.itemProductId, r.itemVariantId,
      r.itemQty, gz(r.itemPriceCents).toFixed(2), (gz(r.itemPriceCents) * r.itemQty).toFixed(2),
      gz(r.subtotalCents).toFixed(2), gz(r.shippingCents).toFixed(2), gz(r.discountCents).toFixed(2),
      gz(r.totalCents).toFixed(2), r.discountCode ?? '',
    ]),
  })

  return {
    csv,
    count: rows.length,
    fileName: `zamowienia_${fromDate ?? 'all'}_${toDate ?? 'now'}.csv`,
  }
}

/**
 * Historia hurtowych importów CSV (audyt panelu). Zwraca wpisy z import_jobs.
 */
export async function adminGetImportJobs(limit = 20) {
  await requireAdmin()
  return db.select().from(importJobs).orderBy(desc(importJobs.createdAt)).limit(limit)
}