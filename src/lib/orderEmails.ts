import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orderItems, orders, shippingAddresses } from '@/db/schema'
import { sendMail } from '@/lib/mail'
import { RETURN_WINDOW_DAYS, SELLER, SELLER_CONFIGURED, absoluteUrl } from '@/lib/site'
import { WITHDRAWAL_PATH } from '@/lib/withdrawals'
import { guestOrderPath } from '@/lib/orderAccess'
import { orderPaymentDeadline } from '@/lib/unpaidOrders.server'
import { formatPaymentDeadline } from '@/lib/paymentDeadline'
import {
  EMAIL_LOGO_PATH, emailButton, emailDetails, emailDocument, emailEyebrow, emailHeading, emailItems, emailNote,
  emailParagraph, emailTotals, escapeHtml as escape,
} from '@/lib/emailLayout'

/*
 * Mail „Dziękujemy za zamówienie” — wysyłany zaraz po złożeniu zamówienia
 * (kasa → `after()`, więc nie opóźnia przekierowania do płatności).
 * Dla zamówienia bez konta link prowadzi na stronę zamówienia gościa
 * z podpisanym tokenem — to jedyna droga powrotu z innego urządzenia.
 * Błąd wysyłki tylko logujemy: zamówienie jest już zapisane.
 *
 * Wygląd (logo, karta, stopka) wspólny z newsletterem: `lib/emailLayout.ts`.
 */

const PAYMENT_LABEL: Record<string, string> = {
  autopay: 'płatność online (BLIK, przelew, karta)',
  przelewy24: 'Przelewy24',
  cod: 'za pobraniem',
}

const money = (cents: number) =>
  (cents / 100).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 }).replace(/\s/g, '&nbsp;')

const shopLinks = () => ({ shopUrl: absoluteUrl('/').replace(/\/$/, ''), logoUrl: absoluteUrl(EMAIL_LOGO_PATH) })
const strong = (html: string) => `<strong style="color:#1b1b1b;font-weight:600;">${html}</strong>`
const CONTACT_FOOTER = 'Masz pytania? Odpowiedz na tę wiadomość — chętnie pomożemy.'

/**
 * Potwierdzenie zawarcia umowy na trwałym nośniku (art. 21 ustawy o prawach
 * konsumenta): kto jest sprzedawcą, regulamin, prawo odstąpienia i jak z niego
 * skorzystać (link do formularza online z wypełnionym numerem zamówienia).
 */
function legalFooter(number: string, email: string): string {
  const link = (path: string, label: string) =>
    `<a href="${absoluteUrl(path)}" style="color:#1b1b1b;text-decoration:underline;">${label}</a>`
  const withdrawalHref = `${WITHDRAWAL_PATH}?${new URLSearchParams({ zamowienie: number, email })}`
  const seller = SELLER_CONFIGURED
    ? `Sprzedawca: ${escape(SELLER.name)}, ${escape(SELLER.address)}, NIP ${escape(SELLER.nip)}${SELLER.registry ? `, ${escape(SELLER.registry)}` : ''}, e-mail ${escape(SELLER.email)}${SELLER.phone ? `, tel. ${escape(SELLER.phone)}` : ''}.<br/>`
    : ''
  return emailParagraph(
    `${seller}` +
      `Umowa zawarta na warunkach ${link('/help/regulamin', 'regulaminu sklepu')}. ` +
      `Masz ${RETURN_WINDOW_DAYS} dni od otrzymania przesyłki na odstąpienie od umowy bez podania przyczyny — ` +
      `najprościej przez ${link(withdrawalHref, 'formularz odstąpienia online')}; zasady zwrotu opisuje strona ${link('/help/zwroty-i-reklamacje', 'Zwroty i reklamacje')}.`,
    { size: 12, muted: true, margin: '28px 0 0' },
  )
}

export async function sendOrderConfirmation(orderId: string): Promise<boolean> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!order) return false
  const [items, [address]] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db.select().from(shippingAddresses).where(eq(shippingAddresses.orderId, orderId)).limit(1),
  ])
  const email = (address?.email || order.guestEmail || '').trim()
  if (!email) return false

  const number = orderId.slice(0, 8).toUpperCase()
  const isGuest = order.userId.startsWith('guest_')
  const link = absoluteUrl(isGuest ? guestOrderPath(orderId) : `/profile/orders/${orderId}`)
  const delivery = address?.pickupPointName
    ? `Punkt odbioru: ${address.pickupPointName}`
    : [address?.street, address?.apartment_number, `${address?.postalCode ?? ''} ${address?.city ?? ''}`.trim()]
        .filter(Boolean)
        .join(', ')
  const awaitingPayment = order.status === 'awaiting_payment'

  const deadline = awaitingPayment ? formatPaymentDeadline(orderPaymentDeadline(order.createdAt)) : ''
  const orderLink = awaitingPayment ? `${link}#platnosc` : link

  const body = [
    emailEyebrow(`Zamówienie #${number}`),
    emailHeading(awaitingPayment ? 'Zamówienie przyjęte — czeka na płatność' : 'Dziękujemy za zamówienie!'),
    emailParagraph(
      awaitingPayment
        ? 'Zapisaliśmy Twoje zamówienie. Gdy tylko otrzymamy płatność, zaczniemy je przygotowywać.'
        : 'Zamówienie trafiło do nas i zajmiemy się nim najszybciej, jak to możliwe. Damy znać, gdy wyruszy w drogę.',
      { margin: '0 0 24px' },
    ),
    awaitingPayment
      ? emailNote(`Jeśli płatność nie została dokończona, możesz opłacić zamówienie do ${strong(escape(deadline))}. Po tym terminie zostanie automatycznie anulowane.`)
      : '',
    emailItems(items.map((item) => ({
      name:   escape(item.name),
      detail: item.variantLabel ? escape(item.variantLabel) : undefined,
      qty:    item.qty,
      amount: money(item.priceCents * item.qty),
    }))),
    emailTotals([
      { label: 'Produkty', value: money(order.subtotalCents) },
      { label: 'Dostawa', value: order.shippingCents ? money(order.shippingCents) : 'Gratis' },
      ...(order.discountCents
        ? [{ label: `Rabat${order.discountCode ? ` (${escape(order.discountCode)})` : ''}`, value: `-${money(order.discountCents)}`, accent: true }]
        : []),
      { label: awaitingPayment ? 'Do zapłaty' : 'Razem', value: money(order.totalCents) },
    ]),
    emailDetails([
      { label: 'Dostawa', value: escape(delivery || '—') },
      { label: 'Płatność', value: escape(PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod) },
    ]),
    emailButton(orderLink, awaitingPayment ? 'Opłać zamówienie' : 'Sprawdź status zamówienia'),
    isGuest
      ? emailParagraph('Zamówienie złożone bez konta — zachowaj tę wiadomość. Przycisk prowadzi prosto do Twojego zamówienia.', { size: 13, muted: true, margin: '20px 0 0' })
      : '',
    legalFooter(number, email),
  ].filter(Boolean).join('\n')

  const html = emailDocument({
    ...shopLinks(),
    title: `Zamówienie #${number}`,
    preheader: awaitingPayment
      ? `Zamówienie #${number} czeka na płatność — opłać je do ${deadline}.`
      : `Dziękujemy! Zamówienie #${number} na kwotę ${(order.totalCents / 100).toFixed(2).replace('.', ',')} zł zostało przyjęte.`,
    body,
    footer: CONTACT_FOOTER,
  })

  try {
    return await sendMail({ to: email, subject: `Zamówienie #${number} — dziękujemy!`, html })
  } catch (error) {
    console.error('[orderEmails] confirmation failed', { orderId, error })
    return false
  }
}

// ─── nieopłacone zamówienie: przypomnienia i anulowanie ───────────────────────

export type UnpaidOrderEmailKind = 'reminder' | 'last-call' | 'cancelled'

/**
 * Maile o nieopłaconym zamówieniu (wysyła je cron `/api/cron/unpaid-orders`):
 *  - `reminder`  — „Twoje zamówienie czeka na płatność” (ok. 1 h po złożeniu),
 *  - `last-call` — „Ostatnia szansa” (12 h przed terminem),
 *  - `cancelled` — „Anulowaliśmy nieopłacone zamówienie” (po terminie).
 * Przycisk prowadzi prosto do sekcji „Zapłać” na stronie zamówienia (gość —
 * link z tokenem, działa na każdym urządzeniu). Zwraca, czy mail wyszedł.
 */
export async function sendUnpaidOrderEmail(orderId: string, kind: UnpaidOrderEmailKind): Promise<boolean> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!order) return false
  // Zamówienie opłacone w międzyczasie — przypomnienie byłoby mylące.
  if (kind !== 'cancelled' && order.status !== 'awaiting_payment') return false
  if (kind === 'cancelled' && order.status !== 'cancelled') return false

  const [items, [address]] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db.select().from(shippingAddresses).where(eq(shippingAddresses.orderId, orderId)).limit(1),
  ])
  const email = (address?.email || order.guestEmail || '').trim()
  if (!email) return false

  const number = orderId.slice(0, 8).toUpperCase()
  const isGuest = order.userId.startsWith('guest_')
  const payLink = absoluteUrl(isGuest ? `${guestOrderPath(orderId)}#platnosc` : `/profile/orders/${orderId}#platnosc`)
  const deadline = formatPaymentDeadline(orderPaymentDeadline(order.createdAt))

  const copy = {
    reminder: {
      subject: `Zamówienie #${number} czeka na płatność`,
      title: 'Twoje zamówienie czeka na płatność',
      lead: `Płatność za zamówienie ${strong(`#${number}`)} nie została dokończona. Zamówienie jest zapisane — wystarczy je opłacić, nie musisz kompletować koszyka od nowa.`,
      note: `Masz czas do ${strong(escape(deadline))}. Po tym terminie zamówienie zostanie automatycznie anulowane.`,
      cta: 'Zapłać za zamówienie',
    },
    'last-call': {
      subject: `Ostatnie godziny na opłacenie zamówienia #${number}`,
      title: 'Ostatnia szansa na opłacenie zamówienia',
      lead: `Zamówienie ${strong(`#${number}`)} wciąż czeka na płatność. Jest zapisane — wystarczy je opłacić, bez ponownego kompletowania koszyka.`,
      note: `Jeśli nie zapłacisz do ${strong(escape(deadline))}, zamówienie zostanie automatycznie anulowane.`,
      cta: 'Zapłać teraz',
    },
    cancelled: {
      subject: `Anulowaliśmy nieopłacone zamówienie #${number}`,
      title: 'Zamówienie zostało anulowane',
      lead: `Nie otrzymaliśmy płatności za zamówienie ${strong(`#${number}`)} w wyznaczonym terminie, więc je anulowaliśmy. Nie pobraliśmy żadnych pieniędzy${order.discountCode ? ', a kod rabatowy możesz wykorzystać ponownie' : ''}.`,
      note: 'Jeśli nadal chcesz te produkty, złóż zamówienie ponownie w sklepie.',
      cta: 'Przejdź do sklepu',
    },
  }[kind]

  const eyebrow = { reminder: 'Płatność', 'last-call': 'Ostatnie godziny', cancelled: 'Zamówienie anulowane' }[kind]
  const tone = kind === 'last-call' ? 'amber' : kind === 'cancelled' ? 'grey' : 'mint'

  const body = [
    emailEyebrow(`${eyebrow} · #${number}`),
    emailHeading(escape(copy.title)),
    emailParagraph(copy.lead, { margin: '0 0 24px' }),
    emailNote(copy.note, tone),
    emailItems(items.map((item) => ({
      name:   escape(item.name),
      detail: item.variantLabel ? escape(item.variantLabel) : undefined,
      qty:    item.qty,
    }))),
    emailTotals([{ label: kind === 'cancelled' ? 'Wartość zamówienia' : 'Do zapłaty', value: money(order.totalCents) }]),
    emailButton(kind === 'cancelled' ? absoluteUrl('/') : payLink, escape(copy.cta)),
  ].join('\n')

  const html = emailDocument({
    ...shopLinks(),
    title: escape(copy.subject),
    preheader: kind === 'cancelled'
      ? `Zamówienie #${number} zostało anulowane — nie pobraliśmy żadnych pieniędzy.`
      : `Opłać zamówienie #${number} do ${deadline}.`,
    body,
    footer: CONTACT_FOOTER,
  })

  try {
    return await sendMail({ to: email, subject: copy.subject, html })
  } catch (error) {
    console.error('[orderEmails] unpaid order mail failed', { orderId, kind, error })
    return false
  }
}
