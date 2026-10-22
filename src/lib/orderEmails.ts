import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orderItems, orders, shippingAddresses } from '@/db/schema'
import { sendMail } from '@/lib/mail'
import { RETURN_COST_NOTE, RETURN_WINDOW_DAYS, SELLER, SELLER_CONFIGURED, absoluteUrl } from '@/lib/site'
import { WITHDRAWAL_PATH } from '@/lib/withdrawals'
import { guestOrderPath } from '@/lib/orderAccess'
import { orderPaymentDeadline } from '@/lib/unpaidOrders.server'
import { formatPaymentDeadline } from '@/lib/paymentDeadline'
import { ORDER_STATUS_LABEL } from '@/lib/orderStatus'
import {
  EMAIL_LOGO_PATH, emailButton, emailDetails, emailDocument, emailHeading, emailItems, emailLink, emailNote,
  emailParagraph, emailSmall, emailStatus, emailStrong as strong, emailThumbUrl, emailTotals, escapeHtml as escape,
  type EmailLineItem,
} from '@/lib/emailLayout'

/*
 * Mail „Dziękujemy za zamówienie” — wysyłany zaraz po złożeniu zamówienia
 * (kasa → `after()`, więc nie opóźnia przekierowania do płatności).
 * Dla zamówienia bez konta link prowadzi na stronę zamówienia gościa
 * z podpisanym tokenem — to jedyna droga powrotu z innego urządzenia.
 * Błąd wysyłki tylko logujemy: zamówienie jest już zapisane.
 *
 * Wygląd (nagłówek, panel pozycji, stopka) wspólny z newsletterem:
 * `lib/emailLayout.ts` — styl strony zamówienia w profilu.
 */

const PAYMENT_LABEL: Record<string, string> = {
  autopay: 'Płatność online (BLIK, przelew, karta)',
  przelewy24: 'Przelewy24',
  cod: 'Za pobraniem',
}

const money = (cents: number) =>
  (cents / 100).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 }).replace(/\s/g, '&nbsp;')

const shopLinks = () => ({ shopUrl: absoluteUrl('/').replace(/\/$/, ''), logoUrl: absoluteUrl(EMAIL_LOGO_PATH) })
const CONTACT_FOOTER = 'Masz pytania? Odpowiedz na tę wiadomość — chętnie pomożemy.'

/**
 * Potwierdzenie zawarcia umowy na trwałym nośniku (art. 21 ustawy o prawach
 * konsumenta): kto jest sprzedawcą, regulamin, prawo odstąpienia i jak z niego
 * skorzystać (link do formularza online z wypełnionym numerem zamówienia).
 */
function legalFooter(number: string, email: string): string {
  const link = (path: string, label: string) => emailLink(absoluteUrl(path), label)
  const withdrawalHref = `${WITHDRAWAL_PATH}?${new URLSearchParams({ zamowienie: number, email })}`
  const seller = SELLER_CONFIGURED
    ? `Sprzedawca: ${escape(SELLER.name)}, ${escape(SELLER.address)}, NIP ${escape(SELLER.nip)}${SELLER.registry ? `, ${escape(SELLER.registry)}` : ''}, e-mail ${escape(SELLER.email)}${SELLER.phone ? `, tel. ${escape(SELLER.phone)}` : ''}.<br/>`
    : ''
  return (
    `${seller}` +
    `Umowa zawarta na warunkach ${link('/help/regulamin', 'regulaminu sklepu')}. ` +
    `Masz ${RETURN_WINDOW_DAYS} dni od otrzymania przesyłki na odstąpienie od umowy bez podania przyczyny — ` +
    `najprościej przez ${link(withdrawalHref, 'formularz odstąpienia online')}; zasady zwrotu opisuje strona ${link('/help/zwroty-i-reklamacje', 'Zwroty i reklamacje')}. ` +
    RETURN_COST_NOTE
  )
}

/** Pozycje zamówienia do panelu w mailu (z miniaturą z CDN Sanity, jeśli zamówienie ją ma). */
function lineItems(items: (typeof orderItems.$inferSelect)[], withAmounts: boolean): EmailLineItem[] {
  return items.map((item) => ({
    name:     escape(item.name),
    detail:   item.variantLabel ? escape(item.variantLabel) : undefined,
    qty:      item.qty,
    amount:   withAmounts ? money(item.priceCents * item.qty) : undefined,
    imageUrl: emailThumbUrl(item.imageUrl),
  }))
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
  // Dwie linijki jak na stronie zamówienia: rodzaj / ulica, potem punkt / kod i miasto.
  const delivery = address?.pickupPointName
    ? `Punkt odbioru<br>${escape(address.pickupPointName)}`
    : [
        escape(`${address?.street ?? ''}${address?.apartment_number ? ` / ${address.apartment_number}` : ''}`.trim()),
        escape(`${address?.postalCode ?? ''} ${address?.city ?? ''}`.trim()),
      ].filter(Boolean).join('<br>')
  const awaitingPayment = order.status === 'awaiting_payment'

  const deadline = awaitingPayment ? formatPaymentDeadline(orderPaymentDeadline(order.createdAt)) : ''
  const orderLink = awaitingPayment ? `${link}#platnosc` : link

  const body = [
    emailHeading(awaitingPayment ? 'Zamówienie przyjęte — czeka na płatność' : 'Dziękujemy za zamówienie'),
    awaitingPayment
      ? emailParagraph('Zapisaliśmy Twoje zamówienie. Gdy tylko otrzymamy płatność, zaczniemy je przygotowywać.')
      : emailParagraph('Zamówienie trafiło do nas i zajmiemy się nim najszybciej, jak to możliwe. Damy znać, gdy wyruszy w drogę.', { margin: '0 0 12px' }),
    awaitingPayment
      ? emailNote(
          'Jeśli płatność nie została dokończona, możesz ją ponowić z poziomu zamówienia. Po tym terminie zamówienie zostanie automatycznie anulowane.',
          { title: `Opłać do ${escape(deadline)}` },
        )
      : emailStatus('Stan zamówienia', escape(ORDER_STATUS_LABEL[order.status] ?? order.status)),
    emailItems(lineItems(items, true)),
    emailTotals([
      { label: 'Produkty', value: money(order.subtotalCents) },
      { label: 'Dostawa', value: order.shippingCents ? money(order.shippingCents) : 'Gratis' },
      ...(order.discountCents
        ? [{ label: `Rabat${order.discountCode ? ` (${escape(order.discountCode)})` : ''}`, value: `-${money(order.discountCents)}`, accent: true }]
        : []),
      { label: awaitingPayment ? 'Do zapłaty' : 'Łącznie', value: money(order.totalCents) },
    ]),
    emailDetails([
      { label: 'Dostawa', value: delivery || '—' },
      { label: 'Płatność', value: escape(PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod) },
    ]),
    emailButton(orderLink, awaitingPayment ? 'Opłać zamówienie' : 'Sprawdź status zamówienia'),
    isGuest
      ? emailSmall('Zamówienie złożone bez konta — zachowaj tę wiadomość. Przycisk prowadzi prosto do Twojego zamówienia.', '20px 0 0')
      : '',
  ].filter(Boolean).join('\n')

  const html = emailDocument({
    ...shopLinks(),
    title: `Zamówienie #${number}`,
    meta: `Zamówienie #${number}`,
    legal: legalFooter(number, email),
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
      noteTitle: `Opłać do ${escape(deadline)}`,
      note: 'Po tym terminie zamówienie zostanie automatycznie anulowane.',
      cta: 'Zapłać za zamówienie',
    },
    'last-call': {
      subject: `Ostatnie godziny na opłacenie zamówienia #${number}`,
      title: 'Zostało kilka godzin na opłacenie zamówienia',
      lead: `Zamówienie ${strong(`#${number}`)} wciąż czeka na płatność. Jest zapisane — wystarczy je opłacić, bez ponownego kompletowania koszyka.`,
      noteTitle: `Termin mija ${escape(deadline)}`,
      note: 'Jeśli do tego czasu nie zapłacisz, zamówienie zostanie automatycznie anulowane.',
      cta: 'Zapłać teraz',
    },
    cancelled: {
      subject: `Anulowaliśmy nieopłacone zamówienie #${number}`,
      title: 'Zamówienie zostało anulowane',
      lead: `Nie otrzymaliśmy płatności za zamówienie ${strong(`#${number}`)} w wyznaczonym terminie, więc je anulowaliśmy. Nie pobraliśmy żadnych pieniędzy${order.discountCode ? ', a kod rabatowy możesz wykorzystać ponownie' : ''}.`,
      noteTitle: '',
      note: 'Jeśli nadal chcesz te produkty, złóż zamówienie ponownie — zajmie to chwilę.',
      cta: 'Przejdź do sklepu',
    },
  }[kind]

  const cancelled = kind === 'cancelled'

  const body = [
    emailHeading(escape(copy.title)),
    emailParagraph(copy.lead, cancelled ? { margin: '0 0 12px' } : {}),
    cancelled
      ? emailStatus('Stan zamówienia', ORDER_STATUS_LABEL.cancelled)
      : emailNote(copy.note, { title: copy.noteTitle, tone: kind === 'last-call' ? 'amber' : 'grey' }),
    emailItems(lineItems(items, false)),
    emailTotals([{ label: cancelled ? 'Wartość zamówienia' : 'Do zapłaty', value: money(order.totalCents) }]),
    cancelled ? emailParagraph(copy.note, { muted: true, size: 14 }) : '',
    emailButton(cancelled ? absoluteUrl('/') : payLink, escape(copy.cta), { secondary: cancelled }),
  ].filter(Boolean).join('\n')

  const html = emailDocument({
    ...shopLinks(),
    title: escape(copy.subject),
    meta: `Zamówienie #${number}`,
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
