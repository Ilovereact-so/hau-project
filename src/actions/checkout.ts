'use server'

import { auth } from '@clerk/nextjs/server'
import { cookies, headers } from 'next/headers'
import { db } from '@/lib/db'
import { orders, orderItems, shippingAddresses, paymentTransactions } from '@/db/schema'
import { cartItems as cartItemsTable } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { redis } from '@/lib/redis'
import { registerTransaction } from '@/lib/przelewy24'
import {
  buildTransactionRequest,
  startTransactionInBackground,
  describeRejection,
  isAutopayConfigured,
  AUTOPAY_BLIK0_ENABLED,
  AUTOPAY_CARD_IFRAME_ENABLED,
  AUTOPAY_BLIK_GATEWAY_ID,
  AUTOPAY_CARD_GATEWAY_ID,
} from '@/lib/autopay'
import { client } from '@/sanity/lib/client'
import { upsertSavedAddress } from '@/actions/address'
import { fetchSanityPrices, resolveProductPrice } from '@/lib/cartPricing'
import { DiscountError, redeemDiscount } from '@/lib/discountServer'

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
  code:     string
  name:     string
  carrier:  string
  street:   string
  city:     string
  postcode: string
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
  gatewayId?:     number         // wybrany kanał Autopay; brak = wybór metody na stronie Autopay
  saveCard?:      boolean        // zgoda na zapamiętanie karty (tokenizacja)
  blikCode?:      string         // BLIK-0: 6-cyfrowy kod z aplikacji banku
  discountCode?:  string
  notes?:         string
}

/** Dane formularza, który przeglądarka wysyła POST-em na bramkę Autopay. */
export interface AutopayFormPayload {
  url:    string
  fields: Record<string, string>
}

/**
 * Płatność uruchomiona bez opuszczania sklepu:
 * `blik` — czekamy na potwierdzenie w aplikacji banku,
 * `card` — `url` ląduje w `<iframe>` z formularzem karty Autopay.
 */
export interface AutopayInlinePayload {
  orderId: string
  mode:    'blik' | 'card'
  url:     string
}

export type CheckoutResult =
  | { ok: true;  redirectUrl: string;                autopayForm?: undefined; autopayInline?: undefined }
  | { ok: true;  autopayForm: AutopayFormPayload;    redirectUrl?: undefined; autopayInline?: undefined }
  | { ok: true;  autopayInline: AutopayInlinePayload; redirectUrl?: undefined; autopayForm?: undefined }
  | { ok: false; error: string; discountRejected?: true }

// ─── Sanity fetches ───────────────────────────────────────────────────────────

async function fetchShippingPriceCents(furgonetkaServiceId: string): Promise<number | null> {
  const result = await client.fetch<{ internal_price: number } | null>(
    `*[_type == "shipping_methods" && furgonetka_service_id == $id && active == true][0]{ internal_price }`,
    { id: furgonetkaServiceId },
  )
  if (!result) return null
  return Math.round((result.internal_price ?? 0) * 100)
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

  for (const item of input.items) {
    if (resolveProductPrice(sanityPrices.get(item.productId)!, item.variantId) === null) {
      return { ok: false, error: `Produkt "${item.name}" jest chwilowo niedostępny` }
    }
  }

  // ── calculate totals ──────────────────────────────────────────────────────
  let subtotalCents = 0
  const lineItems = input.items.map(item => {
    const product    = sanityPrices.get(item.productId)!
    const pricePLN   = resolveProductPrice(product, item.variantId)!
    const priceCents = Math.round(pricePLN * 100)
    subtotalCents   += priceCents * item.qty
    return { ...item, priceCents, name: product.title, brand: product.brand ?? '' }
  })

  // ── persist to DB ─────────────────────────────────────────────────────────
  const orderId   = crypto.randomUUID()
  const sessionId = orderId

  // Kod rabatowy liczony i rezerwowany W TEJ SAMEJ transakcji co zamówienie
  // (lib/discountServer.ts): wiersz kodu jest blokowany, limity sprawdzane
  // ponownie — kwota z koszyka to tylko podgląd, decyduje serwer.
  const discountInput = input.discountCode?.trim() ? input.discountCode : null
  let discountCents = 0
  let discountCode: string | null = null
  let totalCents = subtotalCents + shippingCents

  if (totalCents <= 0) return { ok: false, error: 'Nieprawidłowa kwota zamówienia' }

  try {
    await db.transaction(async tx => {
      if (discountInput) {
        const redeemed = await redeemDiscount(tx, {
          code:          discountInput,
          orderId,
          customer:      { key: ownerId, email: input.address.email.trim().toLowerCase() },
          subtotalCents,
          shippingCents,
        })
        discountCents = redeemed.discountCents
        discountCode  = redeemed.code
        totalCents    = redeemed.totalCents
      }

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
        discountCode,
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
          brand:        item.brand,
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
          id:              crypto.randomUUID(),
          orderId,
          provider:        input.paymentMethod,
          sessionId,
          status:          'pending',
          amountCents:     totalCents,
          saveCardConsent: input.saveCard ?? false,
        })
      }
    })
  } catch (err) {
    // Kod przestał spełniać warunki (wygasł, limit, próg) — zamówienie się
    // wycofało; klient zobaczy powód i może złożyć je bez kodu.
    if (err instanceof DiscountError) return { ok: false, error: err.message, discountRejected: true }
    throw err
  }

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

  // ── initiate payment ──────────────────────────────────────────────────────
  // UWAGA: koszyk czyścimy dopiero po udanym starcie płatności. BLIK-0 potrafi
  // odrzucić transakcję (zły/wygasły kod) i klient musi mieć do czego wrócić.
  const urlReturn = `${APP_URL}/orders/${orderId}?payment=success`
  const urlStatus = `${APP_URL}/api/webhooks/${input.paymentMethod}`

  const result = await initiatePayment({
    input, orderId, sessionId, totalCents, urlReturn, urlStatus,
  })

  if (result.ok) {
    await Promise.all([
      redis.del(`cart:${ownerId}`),
      db.delete(cartItemsTable).where(eq(cartItemsTable.ownerId, ownerId)),
    ])
  }

  return result
}

// ─── uruchomienie płatności ───────────────────────────────────────────────────

interface InitiateArgs {
  input:       CheckoutInput
  orderId:     string
  sessionId:   string
  totalCents:  number
  urlReturn:   string
  urlStatus:   string
}

async function initiatePayment(
  { input, orderId, sessionId, totalCents, urlReturn, urlStatus }: InitiateArgs,
): Promise<CheckoutResult> {
  if (input.paymentMethod === 'przelewy24') {
    // (Przelewy24 zostaje bez zmian — adresy przekazywane są w rejestracji transakcji.)
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
    const isProduction = process.env.NODE_ENV === 'production'

    // Dev bypass: brak realnych danych Autopay — symulujemy natychmiastowy sukces.
    // Zablokowane jawnie w produkcji, żeby brak configu nigdy nie oznaczał zamówienia
    // jako opłaconego bez realnej płatności.
    if (!isAutopayConfigured()) {
      if (isProduction) {
        throw new Error('Autopay nie jest skonfigurowany (brak AUTOPAY_SERVICE_ID/AUTOPAY_HASH_KEY) — płatność odrzucona.')
      }
      return { ok: true, redirectUrl: `${APP_URL}/api/dev/payment-success?orderId=${orderId}` }
    }

    const label = `Zamowienie ${orderId.slice(0, 8).toUpperCase()}`

    const base = {
      orderId,
      amount:          (totalCents / 100).toFixed(2),
      description:     label,
      title:           label,
      customerEmail:   input.address.email,
      gatewayId:       input.gatewayId,
      customerIp:      await clientIp(),
      returnUrl:       `${APP_URL}/api/autopay/return`,
      recurringAction: input.saveCard ? ('INIT_WITH_PAYMENT' as const) : undefined,
    }

    // ── BLIK-0: kod wpisany u nas, potwierdzenie w aplikacji banku ──────────
    if (input.gatewayId === AUTOPAY_BLIK_GATEWAY_ID && AUTOPAY_BLIK0_ENABLED) {
      const code = (input.blikCode ?? '').replace(/\D/g, '')
      if (code.length !== 6) return { ok: false, error: 'Wpisz 6-cyfrowy kod BLIK' }

      try {
        const started = await startTransactionInBackground({ ...base, authorizationCode: code })
        if (!started.ok) {
          console.warn('[Autopay] BLIK-0 odrzucony:', started.reason)
          return { ok: false, error: describeRejection(started.reason) }
        }
        return { ok: true, autopayInline: { orderId, mode: 'blik', url: started.redirectUrl } }
      } catch (err) {
        // Bramka nie przyjęła przedtransakcji — schodzimy do przekierowania,
        // żeby klient mógł zapłacić mimo problemu z BLIK-0.
        console.error('[Autopay] BLIK-0 nieudany, fallback na przekierowanie:', err)
      }
    }

    // ── karta: formularz Autopay w ramce na naszej stronie ──────────────────
    if (input.gatewayId === AUTOPAY_CARD_GATEWAY_ID && AUTOPAY_CARD_IFRAME_ENABLED) {
      try {
        const started = await startTransactionInBackground({ ...base, screenType: 'IFRAME' })
        if (started.ok) {
          return { ok: true, autopayInline: { orderId, mode: 'card', url: started.redirectUrl } }
        }
        console.warn('[Autopay] Formularz karty odrzucony:', started.reason)
      } catch (err) {
        console.error('[Autopay] Iframe karty nieudany, fallback na przekierowanie:', err)
      }
    }

    // ── klasyczne przekierowanie POST na stronę Autopay ─────────────────────
    return { ok: true, autopayForm: buildTransactionRequest(base) }
  }

  await db.update(orders).set({ status: 'processing' }).where(eq(orders.id, orderId))
  return { ok: true, redirectUrl: `${APP_URL}/profile/orders/${orderId}?payment=cod` }
}

// ─── ponowna próba BLIK-0 dla istniejącego zamówienia ─────────────────────────

/**
 * Kod BLIK wygasa po ~2 minutach, więc pomyłka jest częsta. Zamiast kazać
 * klientowi składać zamówienie od nowa, pozwalamy podać nowy kod do tego samego
 * zamówienia (o ile nadal czeka na płatność i należy do tego samego właściciela).
 */
export async function retryBlikPayment(
  orderId: string,
  blikCode: string,
): Promise<CheckoutResult> {
  const code = (blikCode ?? '').replace(/\D/g, '')
  if (code.length !== 6) return { ok: false, error: 'Wpisz 6-cyfrowy kod BLIK' }

  if (!isAutopayConfigured()) return { ok: false, error: 'Płatności są chwilowo niedostępne' }

  const { userId } = await auth()
  const cookieStore = await cookies()
  const ownerId = userId ?? cookieStore.get('guest_id')?.value
  if (!ownerId) return { ok: false, error: 'Sesja wygasła. Odśwież stronę.' }

  const [order] = await db
    .select({ id: orders.id, status: orders.status, totalCents: orders.totalCents, userId: orders.userId })
    .from(orders)
    .where(eq(orders.id, orderId))

  if (!order || order.userId !== ownerId) return { ok: false, error: 'Nie znaleziono zamówienia' }
  if (order.status !== 'awaiting_payment') return { ok: false, error: 'To zamówienie nie oczekuje już na płatność' }

  const [address] = await db
    .select({ email: shippingAddresses.email })
    .from(shippingAddresses)
    .where(eq(shippingAddresses.orderId, orderId))

  if (!address) return { ok: false, error: 'Nie znaleziono danych zamówienia' }

  const label = `Zamowienie ${orderId.slice(0, 8).toUpperCase()}`

  try {
    const started = await startTransactionInBackground({
      orderId,
      amount:            (order.totalCents / 100).toFixed(2),
      description:       label,
      title:             label,
      customerEmail:     address.email,
      gatewayId:         AUTOPAY_BLIK_GATEWAY_ID,
      customerIp:        await clientIp(),
      authorizationCode: code,
    })

    if (!started.ok) return { ok: false, error: describeRejection(started.reason) }
    return { ok: true, autopayInline: { orderId, mode: 'blik', url: started.redirectUrl } }
  } catch (err) {
    console.error('[Autopay] Ponowna próba BLIK nieudana:', err)
    return { ok: false, error: 'Nie udało się uruchomić płatności. Spróbuj ponownie.' }
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** IP klienta dla parametru `CustomerIP`; przy braku sensownej wartości 127.0.0.1. */
async function clientIp(): Promise<string> {
  const headerList = await headers()
  const forwarded = headerList.get('x-forwarded-for')?.split(',')[0]?.trim()
  const candidate = forwarded || headerList.get('x-real-ip')?.trim() || ''
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(candidate) ? candidate : '127.0.0.1'
}
