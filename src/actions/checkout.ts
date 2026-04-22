'use server'

import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { orders, orderItems, shippingAddresses, paymentTransactions } from '@/db/schema'
import { cartItems as cartItemsTable } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { redis } from '@/lib/redis'
import { registerTransaction } from '@/lib/przelewy24'
import { createPaymentUrl } from '@/lib/autopay'
import { getServicePrice } from '@/lib/furgonetka'
import { client } from '@/sanity/lib/client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

// ─── types ────────────────────────────────────────────────────────────────────

export interface CheckoutAddress {
  firstName:  string
  lastName:   string
  email:      string
  phone:      string
  street:     string
  city:       string
  postalCode: string
  country:    'PL'
}

export interface CheckoutItem {
  productId:    string
  variantId:    string
  qty:          number
  // client-supplied for display, server re-validates price from Sanity
  name:         string
  variantLabel: string
  imageUrl:     string
}

export interface CheckoutInput {
  items:          CheckoutItem[]
  address:        CheckoutAddress
  paymentMethod:  'przelewy24' | 'autopay' | 'cod'
  shippingMethod: string // Furgonetka service code
  discountCode?:  string
  notes?:         string
}

export type CheckoutResult =
  | { ok: true;  redirectUrl: string }
  | { ok: false; error: string }

// ─── Sanity price fetch ───────────────────────────────────────────────────────

interface SanityProduct {
  _id:      string
  title:    string
  price:    number
  variants: Array<{ _key: string; price: number }> | null
}

async function fetchSanityPrices(productIds: string[]): Promise<Map<string, SanityProduct>> {
  const data = await client.fetch<SanityProduct[]>(
    `*[_type == "product" && _id in $ids]{ _id, title, price, variants[]{ _key, price } }`,
    { ids: productIds },
  )
  return new Map(data.map(p => [p._id, p]))
}

function resolveProductPrice(product: SanityProduct, variantId: string): number {
  if (variantId) {
    const variant = product.variants?.find(v => v._key === variantId)
    if (variant) return variant.price
  }
  return product.price
}

// ─── validation ───────────────────────────────────────────────────────────────

function validateAddress(a: CheckoutAddress): string | null {
  if (!a.firstName?.trim()) return 'Imię jest wymagane'
  if (!a.lastName?.trim())  return 'Nazwisko jest wymagane'
  if (!a.email?.includes('@')) return 'Nieprawidłowy email'
  if (!a.phone?.trim())     return 'Numer telefonu jest wymagany'
  if (!a.street?.trim())    return 'Ulica jest wymagana'
  if (!a.city?.trim())      return 'Miasto jest wymagane'
  if (!/^\d{2}-\d{3}$/.test(a.postalCode)) return 'Nieprawidłowy kod pocztowy (XX-XXX)'
  return null
}

// ─── main ─────────────────────────────────────────────────────────────────────

export async function checkout(input: CheckoutInput): Promise<CheckoutResult> {
  if (!input.items.length) {
    return { ok: false, error: 'Koszyk jest pusty' }
  }

  const addressError = validateAddress(input.address)
  if (addressError) return { ok: false, error: addressError }

  // ── resolve user ──────────────────────────────────────────────────────────
  const { userId } = await auth()
  const cookieStore = await cookies()
  const guestId     = cookieStore.get('guest_id')?.value
  const ownerId     = userId ?? guestId

  if (!ownerId) return { ok: false, error: 'Sesja wygasła. Odśwież stronę.' }

  // ── validate prices from Sanity ───────────────────────────────────────────
  const productIds   = [...new Set(input.items.map(i => i.productId))]
  const sanityPrices = await fetchSanityPrices(productIds)

  for (const item of input.items) {
    if (!sanityPrices.has(item.productId)) {
      return { ok: false, error: `Produkt "${item.name}" nie istnieje` }
    }
  }

  // ── validate shipping price from Furgonetka ───────────────────────────────
  let shippingCents: number
  try {
    shippingCents = await getServicePrice(input.shippingMethod)
  } catch {
    return { ok: false, error: 'Wybrany sposób dostawy jest niedostępny' }
  }

  // ── calculate totals ──────────────────────────────────────────────────────
  let subtotalCents = 0
  const lineItems = input.items.map(item => {
    const product    = sanityPrices.get(item.productId)!
    const pricePLN   = resolveProductPrice(product, item.variantId)
    const priceCents = Math.round(pricePLN * 100)
    subtotalCents   += priceCents * item.qty
    return { ...item, priceCents, name: product.title }
  })

  // discount placeholder — extend here with real coupon logic
  const discountCents = 0
  const totalCents    = subtotalCents + shippingCents - discountCents

  if (totalCents <= 0) return { ok: false, error: 'Nieprawidłowa kwota zamówienia' }

  // ── persist to DB ─────────────────────────────────────────────────────────
  const orderId   = crypto.randomUUID()
  const sessionId = orderId // P24 uses sessionId = our orderId

  await db.transaction(async tx => {
    await tx.insert(orders).values({
      id:             orderId,
      userId:         ownerId,
      guestEmail:     !userId ? input.address.email : null,
      status:         'awaiting_payment',
      paymentMethod:  input.paymentMethod,
      shippingMethod: input.shippingMethod,
      subtotalCents,
      shippingCents,
      discountCents,
      totalCents,
      discountCode:   input.discountCode ?? null,
      notes:          input.notes ?? null,
    })

    await tx.insert(orderItems).values(
      lineItems.map(item => ({
        id:           crypto.randomUUID(),
        orderId,
        productId:    item.productId,
        variantId:    item.variantId,
        qty:          item.qty,
        priceCents:   item.priceCents,
        name:         item.name,
        variantLabel: item.variantLabel,
        imageUrl:     item.imageUrl,
      })),
    )

    await tx.insert(shippingAddresses).values({
      id:         crypto.randomUUID(),
      orderId,
      firstName:  input.address.firstName,
      lastName:   input.address.lastName,
      email:      input.address.email,
      phone:      input.address.phone,
      street:     input.address.street,
      city:       input.address.city,
      postalCode: input.address.postalCode,
      country:    input.address.country,
    })

    if (input.paymentMethod !== 'cod') {
      await tx.insert(paymentTransactions).values({
        id:          crypto.randomUUID(),
        orderId,
        provider:    input.paymentMethod,
        sessionId,
        status:      'pending',
        amountCents: totalCents,
      })
    }
  })

  // ── clear cart ────────────────────────────────────────────────────────────
  await Promise.all([
    redis.del(`cart:${ownerId}`),
    db.delete(cartItemsTable).where(eq(cartItemsTable.ownerId, ownerId)),
  ])

  // ── initiate payment ──────────────────────────────────────────────────────
  const urlReturn = `${APP_URL}/orders/${orderId}?payment=success`
  const urlStatus = `${APP_URL}/api/webhooks/${input.paymentMethod}`

  if (input.paymentMethod === 'przelewy24') {
    const { redirectUrl } = await registerTransaction({
      sessionId,
      amount:      totalCents,
      currency:    'PLN',
      description: `Zamówienie #${orderId.slice(0, 8).toUpperCase()}`,
      email:       input.address.email,
      urlReturn,
      urlStatus,
    })
    return { ok: true, redirectUrl }
  }

  if (input.paymentMethod === 'autopay') {
    const amountPLN = (totalCents / 100).toFixed(2)
    const { redirectUrl } = createPaymentUrl({
      orderId,
      amount:        amountPLN,
      description:   `Zamówienie #${orderId.slice(0, 8).toUpperCase()}`,
      customerEmail: input.address.email,
      urlReturn,
      urlStatus,
    })
    return { ok: true, redirectUrl }
  }

  // cod — no external redirect
  await db.update(orders).set({ status: 'processing' }).where(eq(orders.id, orderId))
  return { ok: true, redirectUrl: `${APP_URL}/orders/${orderId}?payment=cod` }
}

// ─── shipping services ────────────────────────────────────────────────────────

export async function getShippingServices() {
  const { getAvailableServices } = await import('@/lib/furgonetka')
  return getAvailableServices()
}
