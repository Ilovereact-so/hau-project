'use server'

import { auth } from '@clerk/nextjs/server'
import { headers } from 'next/headers'
import { after } from 'next/server'
import { sendOrderConfirmation } from '@/lib/orderEmails'
import { db } from '@/lib/db'
import { orders, orderItems, shippingAddresses, paymentTransactions } from '@/db/schema'
import { cartItems as cartItemsTable } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
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
  AUTOPAY_ONECLICK_GATEWAY_ID,
  AUTOPAY_RECURRING_ENABLED,
} from '@/lib/autopay'
import { findCardTokenForUser } from '@/lib/savedCards.server'
import { expireIfOverdue, orderPaymentDeadline, PAYMENT_DEADLINE_HOURS } from '@/lib/unpaidOrders.server'
import { resolveOrderAccess } from '@/lib/orderAccess'
import { client } from '@/sanity/lib/client'
import { upsertSavedAddress } from '@/actions/address'
import { fetchSanityPrices, resolveProductPrice } from '@/lib/cartPricing'
import { DiscountError, redeemDiscount } from '@/lib/discountServer'
import { getOrCreateGuestId } from '@/lib/cartServer'
import { getShopSettings } from '@/lib/shopSettings.server'
import { qualifiesForFreeShipping } from '@/lib/shopSettings'
import { maxOrderQty } from '@/lib/stock'

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
  saveCard?:      boolean        // zgoda na zapamiętanie karty (One Click, kanał 1503)
  savedCardId?:   string         // płatność zapisaną kartą — `saved_cards.id` (token zostaje na serwerze)
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
  /**
   * Podpisany token zamówienia gościa (link z maila na innym urządzeniu) —
   * panel przekazuje go do `/api/orders/[id]/status`, bo nie ma ciasteczka `guest_id`.
   */
  accessToken?: string
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
  // Zakup bez logowania: gość dostaje (albo ma już) ciasteczko `guest_id`
  // i to ono jest właścicielem zamówienia — po nim gość wraca na stronę
  // zamówienia (/zamowienie/[id]); działa też podpisany link z tokenem.
  const { userId } = await auth()
  const ownerId     = userId ?? (await getOrCreateGuestId())

  if (!ownerId) return { ok: false, error: 'Sesja wygasła. Odśwież stronę.' }

  // ── zapisane karty (Autopay One Click, kanał 1503) ────────────────────────
  // Tylko zalogowani i tylko przy włączonej usłudze. Token zapisanej karty
  // bierzemy z bazy po `id` I właścicielu — przeglądarka nigdy go nie widzi,
  // więc nie da się zapłacić cudzą kartą, podmieniając identyfikator.
  const isCardGateway = input.gatewayId === AUTOPAY_CARD_GATEWAY_ID || input.gatewayId === AUTOPAY_ONECLICK_GATEWAY_ID
  let savedCardToken: string | null = null
  if (input.savedCardId) {
    if (!AUTOPAY_RECURRING_ENABLED || !userId || input.paymentMethod !== 'autopay') {
      return { ok: false, error: 'Płatność zapisaną kartą jest teraz niedostępna. Wybierz inną metodę płatności.' }
    }
    savedCardToken = await findCardTokenForUser(userId, input.savedCardId)
    if (!savedCardToken) {
      return { ok: false, error: 'Tej karty nie ma już na Twoim koncie. Wybierz inną metodę płatności.' }
    }
  }
  const saveNewCard =
    !savedCardToken &&
    Boolean(input.saveCard) &&
    AUTOPAY_RECURRING_ENABLED &&
    Boolean(userId) &&
    input.paymentMethod === 'autopay' &&
    isCardGateway

  // ── validate prices from Sanity ───────────────────────────────────────────
  const productIds   = [...new Set(input.items.map(i => i.productId))]
  const sanityPrices = await fetchSanityPrices(productIds)

  for (const item of input.items) {
    if (!sanityPrices.has(item.productId)) {
      return { ok: false, error: `Produkt "${item.name}" nie istnieje` }
    }
  }

  // ── validate shipping price from Sanity ──────────────────────────────────
  let shippingCents = await fetchShippingPriceCents(input.shippingMethod)
  if (shippingCents === null) {
    return { ok: false, error: 'Wybrany sposób dostawy jest niedostępny' }
  }

  // Ilości z przeglądarki: tylko liczby całkowite 1–99; ta sama pozycja
  // w kilku liniach liczy się łącznie do stanu magazynu.
  const qtyByLine = new Map<string, number>()
  for (const item of input.items) {
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) {
      return { ok: false, error: `Nieprawidłowa ilość produktu "${item.name}"` }
    }
    const key = `${item.productId}::${item.variantId}`
    qtyByLine.set(key, (qtyByLine.get(key) ?? 0) + item.qty)
  }

  for (const item of input.items) {
    const product = sanityPrices.get(item.productId)!
    if (resolveProductPrice(product, item.variantId) === null) {
      return { ok: false, error: `Produkt "${item.name}" jest chwilowo niedostępny` }
    }
    // Stan magazynu — sklep ma niskie stany, więc sprawdzamy go przy każdym
    // zamówieniu (stan nieprowadzony = bez limitu).
    const available = maxOrderQty(product, item.variantId || null)
    if (available <= 0) {
      return { ok: false, error: `Produkt "${item.name}" jest już niedostępny — usuń go z koszyka.` }
    }
    if ((qtyByLine.get(`${item.productId}::${item.variantId}`) ?? item.qty) > available) {
      return { ok: false, error: `Produktu "${item.name}" mamy tylko ${available} szt. — zmniejsz ilość w koszyku.` }
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

  // ── darmowa dostawa od progu (panel → Dostawy) ───────────────────────────
  // Liczona od wartości produktów przed kodem rabatowym — tak samo pokazuje
  // ją koszyk. Świeży odczyt, bez cache.
  const shopSettings = await getShopSettings({ fresh: true })
  if (qualifiesForFreeShipping(shopSettings, subtotalCents)) shippingCents = 0

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
          saveCardConsent: saveNewCard,
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
  // /orders/[id] sam kieruje zalogowanego do profilu, a gościa na stronę
  // zamówienia gościa (ciasteczko guest_id + podpisany link).
  const urlReturn = `${APP_URL}/orders/${orderId}?payment=success`
  const urlStatus = `${APP_URL}/api/webhooks/${input.paymentMethod}`

  const result = await initiatePayment({
    payment: {
      paymentMethod: input.paymentMethod,
      gatewayId:     input.gatewayId,
      blikCode:      input.blikCode,
      email:         input.address.email,
    },
    orderId, sessionId, totalCents, urlReturn, urlStatus,
    // Bramka nie przyjmie wpłaty po terminie płatności zamówienia.
    validUntil: new Date(Date.now() + PAYMENT_DEADLINE_HOURS * 3_600_000),
    card: { savedCardToken, saveNewCard, isCardGateway },
  })

  if (result.ok) {
    await Promise.all([
      redis.del(`cart:${ownerId}`),
      db.delete(cartItemsTable).where(eq(cartItemsTable.ownerId, ownerId)),
    ])
    // Mail z potwierdzeniem (dla gościa — z linkiem do zamówienia). Po
    // odpowiedzi, żeby nie opóźniać przejścia do płatności.
    after(() => sendOrderConfirmation(orderId).catch((err) => console.error('[checkout] confirmation mail', err)))
  }

  return result
}

// ─── uruchomienie płatności ───────────────────────────────────────────────────

/** To, czego potrzebuje start płatności — wspólne dla kasy i „Zapłać ponownie”. */
interface PaymentChoice {
  paymentMethod: CheckoutInput['paymentMethod']
  gatewayId?:    number
  blikCode?:     string
  email:         string
}

interface InitiateArgs {
  payment:     PaymentChoice
  orderId:     string
  sessionId:   string
  totalCents:  number
  urlReturn:   string
  urlStatus:   string
  /** Termin płatności zamówienia → `ValidityTime` transakcji Autopay. */
  validUntil:  Date
  /** Tryb karty ustalony i sprawdzony wcześniej (token z bazy, zgoda, kanał). */
  card:        { savedCardToken: string | null; saveNewCard: boolean; isCardGateway: boolean }
  /** Token zamówienia gościa — trafia do panelu płatności (odpytywanie statusu). */
  accessToken?: string
}

async function initiatePayment(
  { payment: input, orderId, sessionId, totalCents, urlReturn, urlStatus, validUntil, card, accessToken }: InitiateArgs,
): Promise<CheckoutResult> {
  const { savedCardToken, saveNewCard, isCardGateway } = card
  if (input.paymentMethod === 'przelewy24') {
    // (Przelewy24 zostaje bez zmian — adresy przekazywane są w rejestracji transakcji.)
    const { redirectUrl } = await registerTransaction({
      sessionId,
      amount:      totalCents,
      currency:    'PLN',
      description: `Zamówienie #${orderId.slice(0, 8).toUpperCase()}`,
      email:       input.email,
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
      customerEmail:   input.email,
      validityTime:    validUntil,
      // Zapis karty i płatność zapisaną kartą idą kanałem One Click (1503).
      gatewayId:       savedCardToken || saveNewCard ? AUTOPAY_ONECLICK_GATEWAY_ID : input.gatewayId,
      customerIp:      await clientIp(),
      returnUrl:       `${APP_URL}/api/autopay/return`,
      ...(savedCardToken
        ? { recurringAction: 'MANUAL' as const, clientHash: savedCardToken }
        : saveNewCard
          ? { recurringAction: 'INIT_WITH_PAYMENT' as const, recurringAcceptanceState: 'ACCEPTED' as const }
          : {}),
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
        if (!started.redirectUrl) throw new Error('Autopay: BLIK-0 bez adresu oczekiwania.')
        return { ok: true, autopayInline: { orderId, mode: 'blik', url: started.redirectUrl, accessToken } }
      } catch (err) {
        // Bramka nie przyjęła przedtransakcji — schodzimy do przekierowania,
        // żeby klient mógł zapłacić mimo problemu z BLIK-0.
        console.error('[Autopay] BLIK-0 nieudany, fallback na przekierowanie:', err)
      }
    }

    // ── karta: formularz Autopay w ramce na naszej stronie ──────────────────
    // Dotyczy też zapisu karty i płatności zapisaną kartą: w ramce pokazuje się
    // formularz karty albo weryfikacja 3-D Secure banku.
    if ((isCardGateway || savedCardToken) && AUTOPAY_CARD_IFRAME_ENABLED) {
      try {
        const started = await startTransactionInBackground({ ...base, screenType: 'IFRAME' })
        if (started.ok && started.redirectUrl) {
          return { ok: true, autopayInline: { orderId, mode: 'card', url: started.redirectUrl, accessToken } }
        }
        if (started.ok) {
          // Zapisana karta obciążona bez dodatkowej weryfikacji — wynik
          // potwierdzi ITN, strona zamówienia pokaże „czekamy na potwierdzenie”.
          return { ok: true, redirectUrl: `${APP_URL}/orders/${orderId}?payment=pending` }
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
  return { ok: true, redirectUrl: `${APP_URL}/orders/${orderId}?payment=cod` }
}

// ─── ponowna płatność za istniejące zamówienie ────────────────────────────────

/** Wybór metody przy „Zapłać ponownie” — te same opcje co w kasie (bez pobrania). */
export interface RepaySelection {
  /** Kanał Autopay; brak = „Inne metody płatności” (wybór na stronie Autopay). */
  gatewayId?:   number
  blikCode?:    string
  /** Zapisana karta z konta (tylko zalogowany właściciel). */
  savedCardId?: string
  /** Zapamiętaj kartę przy tej płatności (tylko zalogowany właściciel). */
  saveCard?:    boolean
}

/** Ile czasu przed terminem przestajemy przyjmować nowe płatności (bramka potrzebuje chwili). */
const REPAY_MIN_MINUTES_LEFT = 5

/**
 * „Zapłać ponownie” — płatność za zamówienie, które czeka na wpłatę (nieudana
 * płatność, zamknięte okno bramki, porzucona strona banku). Jak w dużych
 * sklepach: zamówienie zostaje, klient wybiera metodę jeszcze raz — ze strony
 * zamówienia, z maila z przypomnieniem albo z pustego koszyka.
 *
 * Dostęp: zalogowany właściciel, gość w tej samej przeglądarce (`guest_id`)
 * albo posiadacz podpisanego linku z maila (`accessToken`). Po terminie
 * zamówienie jest anulowane i płatność nie jest przyjmowana.
 */
export async function payExistingOrder(
  orderId: string,
  selection: RepaySelection,
  accessToken?: string,
): Promise<CheckoutResult> {
  if (typeof orderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return { ok: false, error: 'Nie znaleziono zamówienia' }
  }

  const { access } = await resolveOrderAccess(orderId, accessToken ?? null)
  if (!access) return { ok: false, error: 'Nie znaleziono zamówienia' }

  const [order] = await db
    .select({
      id:            orders.id,
      status:        orders.status,
      totalCents:    orders.totalCents,
      userId:        orders.userId,
      paymentMethod: orders.paymentMethod,
      createdAt:     orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
  if (!order) return { ok: false, error: 'Nie znaleziono zamówienia' }

  const status = await expireIfOverdue(order)
  if (status === 'cancelled') {
    return { ok: false, error: 'Termin płatności minął — zamówienie zostało anulowane. Możesz złożyć je ponownie.' }
  }
  if (status !== 'awaiting_payment') {
    return { ok: false, error: status === 'paid' || status === 'processing'
      ? 'To zamówienie jest już opłacone.'
      : 'To zamówienie nie oczekuje już na płatność.' }
  }
  if (order.paymentMethod !== 'autopay') {
    return { ok: false, error: 'Tego zamówienia nie da się opłacić online. Skontaktuj się z nami.' }
  }

  const deadline = orderPaymentDeadline(order.createdAt)
  if (deadline.getTime() - Date.now() < REPAY_MIN_MINUTES_LEFT * 60_000) {
    return { ok: false, error: 'Termin płatności właśnie mija — nie zdążymy przyjąć płatności. Złóż zamówienie ponownie.' }
  }

  const [address] = await db
    .select({ email: shippingAddresses.email })
    .from(shippingAddresses)
    .where(eq(shippingAddresses.orderId, orderId))
  if (!address?.email) return { ok: false, error: 'Nie znaleziono danych zamówienia' }

  // Zapisane karty — tylko zalogowany właściciel zamówienia (jak w kasie).
  const { userId } = await auth()
  const isOwnerUser = Boolean(userId) && userId === order.userId
  const gatewayId = selection.gatewayId
  const isCardGateway = gatewayId === AUTOPAY_CARD_GATEWAY_ID || gatewayId === AUTOPAY_ONECLICK_GATEWAY_ID
  let savedCardToken: string | null = null
  if (selection.savedCardId) {
    if (!AUTOPAY_RECURRING_ENABLED || !isOwnerUser) {
      return { ok: false, error: 'Płatność zapisaną kartą jest teraz niedostępna. Wybierz inną metodę płatności.' }
    }
    savedCardToken = await findCardTokenForUser(userId as string, selection.savedCardId)
    if (!savedCardToken) return { ok: false, error: 'Tej karty nie ma już na Twoim koncie. Wybierz inną metodę płatności.' }
  }
  const saveNewCard = !savedCardToken && Boolean(selection.saveCard) && AUTOPAY_RECURRING_ENABLED && isOwnerUser && isCardGateway

  if (!isAutopayConfigured() && process.env.NODE_ENV === 'production') {
    return { ok: false, error: 'Płatności są chwilowo niedostępne. Spróbuj za chwilę.' }
  }

  // Nowa próba płatności: poprzednie otwarte próby wygasają, historia zostaje.
  await db.transaction(async (tx) => {
    await tx
      .update(paymentTransactions)
      .set({ status: 'expired' })
      .where(and(eq(paymentTransactions.orderId, orderId), eq(paymentTransactions.status, 'pending')))
    await tx.insert(paymentTransactions).values({
      id:              crypto.randomUUID(),
      orderId,
      provider:        'autopay',
      sessionId:       orderId,
      status:          'pending',
      amountCents:     order.totalCents,
      saveCardConsent: saveNewCard,
    })
  })

  return initiatePayment({
    payment: {
      paymentMethod: 'autopay',
      gatewayId,
      blikCode:      selection.blikCode,
      email:         address.email,
    },
    orderId,
    sessionId:   orderId,
    totalCents:  order.totalCents,
    urlReturn:   `${APP_URL}/orders/${orderId}?payment=success`,
    urlStatus:   `${APP_URL}/api/webhooks/autopay`,
    validUntil:  deadline,
    card:        { savedCardToken, saveNewCard, isCardGateway },
    accessToken: access === 'token' ? accessToken : undefined,
  })
}

/**
 * Kod BLIK wygasa po ~2 minutach, więc pomyłka jest częsta — nowy kod do tego
 * samego zamówienia (panel BLIK-0 po odrzuceniu kodu). Szczególny przypadek
 * `payExistingOrder`.
 */
export async function retryBlikPayment(
  orderId: string,
  blikCode: string,
  accessToken?: string,
): Promise<CheckoutResult> {
  const code = (blikCode ?? '').replace(/\D/g, '')
  if (code.length !== 6) return { ok: false, error: 'Wpisz 6-cyfrowy kod BLIK' }
  if (!isAutopayConfigured()) return { ok: false, error: 'Płatności są chwilowo niedostępne' }
  return payExistingOrder(orderId, { gatewayId: AUTOPAY_BLIK_GATEWAY_ID, blikCode: code }, accessToken)
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** IP klienta dla parametru `CustomerIP`; przy braku sensownej wartości 127.0.0.1. */
async function clientIp(): Promise<string> {
  const headerList = await headers()
  const forwarded = headerList.get('x-forwarded-for')?.split(',')[0]?.trim()
  const candidate = forwarded || headerList.get('x-real-ip')?.trim() || ''
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(candidate) ? candidate : '127.0.0.1'
}
