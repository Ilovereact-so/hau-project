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
import { client } from '@/sanity/lib/client'
import { upsertSavedAddress } from '@/actions/address'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

// ─── types ────────────────────────────────────────────────────────────────────

export interface CheckoutAddress {
  firstName:  string
  lastName:   string
  email:      string
  phone:      string
  street:     string
  apartment_number?: string
  city:       string
  postalCode: string
  country:    'PL'
}

export interface CheckoutPickupPoint {
  code:    string  // point.code from Furgonetka widget
  name:    string  // point.name from Furgonetka widget
  carrier: string  // point.type from Furgonetka widget
}

export interface CheckoutItem {
  productId:    string
  variantId:    string
  qty:          number
  name:         string
  variantLabel: string
  imageUrl:     string
}

export interface CheckoutInput {
  items:          CheckoutItem[]
  address:        CheckoutAddress
  paymentMethod:  'przelewy24' | 'autopay' | 'cod'
  shippingMethod: string         // furgonetka_service_id from Sanity
  deliveryType:   'kurier' | 'automat'
  pickupPoint?:   CheckoutPickupPoint
  discountCode?:  string
  notes?:         string
}

export type CheckoutResult =
  | { ok: true;  redirectUrl: string }
  | { ok: false; error: string }

// ─── Sanity fetches ───────────────────────────────────────────────────────────

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

async function fetchShippingPriceCents(furgonetkaServiceId: string): Promise<number | null> {
  const result = await client.fetch<{ internal_price: number } | null>(
    `*[_type == "shipping_methods" && furgonetka_service_id == $id && active == true][0]{ internal_price }`,
    { id: furgonetkaServiceId },
  )
  if (!result) return null
  return Math.round((result.internal_price ?? 0) * 100)
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
  return null
}

function validateCourierAddress(a: CheckoutAddress): string | null {
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

  if (input.deliveryType === 'kurier') {
    const courierError = validateCourierAddress(input.address)
    if (courierError) return { ok: false, error: courierError }
  }

  if (input.deliveryType === 'automat' && !input.pickupPoint?.code) {
    return { ok: false, error: 'Wybierz punkt odbioru' }
  }

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

  // ── validate shipping price from Sanity ──────────────────────────────────
  const shippingCents = await fetchShippingPriceCents(input.shippingMethod)
  if (shippingCents === null) {
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

  const discountCents = 0
  const totalCents    = subtotalCents + shippingCents - discountCents

  if (totalCents <= 0) return { ok: false, error: 'Nieprawidłowa kwota zamówienia' }

  // ── persist to DB ─────────────────────────────────────────────────────────
  const orderId   = crypto.randomUUID()
  const sessionId = orderId

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
      id:              crypto.randomUUID(),
      orderId,
      firstName:       input.address.firstName,
      lastName:        input.address.lastName,
      email:           input.address.email,
      phone:           input.address.phone,
      street:           input.deliveryType === 'kurier' ? input.address.street            : null,
      city:             input.deliveryType === 'kurier' ? input.address.city              : null,
      apartment_number: input.deliveryType === 'kurier' ? input.address.apartment_number  : null,
      postalCode:       input.deliveryType === 'kurier' ? input.address.postalCode        : null,
      country:         input.address.country,
      pickupPointCode: input.pickupPoint?.code ?? null,
      pickupPointName: input.pickupPoint?.name ?? null,
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

  // ── save address for logged-in user ───────────────────────────────────────
  if (userId && input.deliveryType === 'kurier') {
    await upsertSavedAddress({
      firstName:  input.address.firstName,
      lastName:   input.address.lastName,
      email:      input.address.email,
      phone:      input.address.phone,
      street:     input.address.street,
      city:       input.address.city,
      apartment_number: input.address.apartment_number,
      postalCode: input.address.postalCode,
      country:    'PL',
    })
  }

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

  await db.update(orders).set({ status: 'processing' }).where(eq(orders.id, orderId))
  return { ok: true, redirectUrl: `${APP_URL}/orders/${orderId}?payment=cod` }
}
