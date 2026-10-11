import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orderItems, orders, shippingAddresses } from '@/db/schema'
import { sendMail } from '@/lib/mail'
import { absoluteUrl } from '@/lib/site'
import { guestOrderPath } from '@/lib/orderAccess'
import { orderPaymentDeadline } from '@/lib/unpaidOrders.server'
import { formatPaymentDeadline } from '@/lib/paymentDeadline'

/*
 * Mail „Dziękujemy za zamówienie” — wysyłany zaraz po złożeniu zamówienia
 * (kasa → `after()`, więc nie opóźnia przekierowania do płatności).
 * Dla zamówienia bez konta link prowadzi na stronę zamówienia gościa
 * z podpisanym tokenem — to jedyna droga powrotu z innego urządzenia.
 * Błąd wysyłki tylko logujemy: zamówienie jest już zapisane.
 *
 * HTML mailowy: tabele + style inline (jak szablon newslettera).
 */

const PAYMENT_LABEL: Record<string, string> = {
  autopay: 'płatność online (BLIK, przelew, karta)',
  przelewy24: 'Przelewy24',
  cod: 'za pobraniem',
}

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const money = (cents: number) =>
  (cents / 100).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 })

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

  const rows = items
    .map(
      (item) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eeeeee;font-size:14px;color:#20201f;">
          ${escape(item.name)}${item.variantLabel ? `<br><span style="font-size:12px;color:#6c6c6c;">${escape(item.variantLabel)}</span>` : ''}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #eeeeee;font-size:14px;color:#6c6c6c;text-align:center;white-space:nowrap;">${item.qty} szt.</td>
        <td style="padding:8px 0;border-bottom:1px solid #eeeeee;font-size:14px;color:#20201f;text-align:right;white-space:nowrap;">${money(item.priceCents * item.qty)}</td>
      </tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Zamówienie #${number}</title></head>
<body style="margin:0;padding:0;background:#f4f4f2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f2;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;font-family:'Poppins',Helvetica,Arial,sans-serif;color:#20201f;">
  <tr><td style="padding:0 8px 20px;font-size:22px;font-weight:700;letter-spacing:3px;">HAU</td></tr>
  <tr><td style="background:#ffffff;border:1px solid #e8e8e8;border-radius:24px;padding:36px 36px 32px;">
    <h1 style="margin:0 0 8px;font-size:24px;line-height:1.3;font-weight:600;">Dziękujemy za zamówienie!</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a4a4a;">
      Numer zamówienia: <strong style="color:#20201f;">#${number}</strong>.
      ${awaitingPayment ? `Czekamy na potwierdzenie płatności — jeśli nie udało się jej dokończyć, opłać zamówienie z linku poniżej do ${escape(formatPaymentDeadline(orderPaymentDeadline(order.createdAt)))}.` : 'Zajmiemy się nim najszybciej, jak to możliwe.'}
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;font-size:14px;">
      <tr><td style="color:#6c6c6c;padding:3px 0;">Produkty</td><td style="text-align:right;">${money(order.subtotalCents)}</td></tr>
      <tr><td style="color:#6c6c6c;padding:3px 0;">Dostawa</td><td style="text-align:right;">${order.shippingCents ? money(order.shippingCents) : 'Gratis'}</td></tr>
      ${order.discountCents ? `<tr><td style="color:#3f8f84;padding:3px 0;">Rabat${order.discountCode ? ` (${escape(order.discountCode)})` : ''}</td><td style="text-align:right;color:#3f8f84;">-${money(order.discountCents)}</td></tr>` : ''}
      <tr><td style="padding:8px 0 0;font-weight:600;">Do zapłaty</td><td style="padding:8px 0 0;text-align:right;font-weight:600;">${money(order.totalCents)}</td></tr>
    </table>
    <p style="margin:20px 0 4px;font-size:13px;color:#6c6c6c;">Dostawa: <span style="color:#20201f;">${escape(delivery || '—')}</span></p>
    <p style="margin:0 0 24px;font-size:13px;color:#6c6c6c;">Płatność: <span style="color:#20201f;">${escape(PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod)}</span></p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#20201f;border-radius:999px;">
      <a href="${awaitingPayment ? `${link}#platnosc` : link}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${awaitingPayment ? 'Opłać zamówienie' : 'Sprawdź status zamówienia'}</a>
    </td></tr></table>
    ${isGuest ? '<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#8e8e8e;">Zamówienie złożone bez konta — zachowaj tę wiadomość, link prowadzi prosto do Twojego zamówienia.</p>' : ''}
  </td></tr>
  <tr><td style="padding:20px 16px 0;font-size:12px;line-height:1.6;color:#8e8e8e;text-align:center;">
    Pytania? Odpowiedz na tę wiadomość.<br><a href="${absoluteUrl('/')}" style="color:#8e8e8e;">e-hau.pl</a>
  </td></tr>
</table></td></tr></table>
</body></html>`

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
      lead: `Płatność za zamówienie <strong style="color:#20201f;">#${number}</strong> nie została dokończona. Zamówienie jest zapisane — wystarczy je opłacić, nie musisz kompletować koszyka od nowa.`,
      note: `Masz czas do <strong style="color:#20201f;">${escape(deadline)}</strong>. Po tym terminie zamówienie zostanie anulowane.`,
      cta: 'Zapłać za zamówienie',
    },
    'last-call': {
      subject: `Ostatnie godziny na opłacenie zamówienia #${number}`,
      title: 'Ostatnia szansa na opłacenie zamówienia',
      lead: `Zamówienie <strong style="color:#20201f;">#${number}</strong> wciąż czeka na płatność.`,
      note: `Jeśli nie zapłacisz do <strong style="color:#20201f;">${escape(deadline)}</strong>, zamówienie zostanie automatycznie anulowane.`,
      cta: 'Zapłać teraz',
    },
    cancelled: {
      subject: `Anulowaliśmy nieopłacone zamówienie #${number}`,
      title: 'Zamówienie zostało anulowane',
      lead: `Nie otrzymaliśmy płatności za zamówienie <strong style="color:#20201f;">#${number}</strong> w wyznaczonym terminie, więc je anulowaliśmy. Nie pobraliśmy żadnych pieniędzy${order.discountCode ? ', a kod rabatowy możesz wykorzystać ponownie' : ''}.`,
      note: 'Jeśli nadal chcesz te produkty, złóż zamówienie ponownie w sklepie.',
      cta: 'Przejdź do sklepu',
    },
  }[kind]

  const rows = items
    .map(
      (item) => `<tr>
        <td style="padding:6px 0;border-bottom:1px solid #eeeeee;font-size:14px;color:#20201f;">${escape(item.name)}${item.variantLabel ? ` <span style="font-size:12px;color:#6c6c6c;">· ${escape(item.variantLabel)}</span>` : ''}</td>
        <td style="padding:6px 0;border-bottom:1px solid #eeeeee;font-size:14px;color:#6c6c6c;text-align:right;white-space:nowrap;">${item.qty} szt.</td>
      </tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(copy.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f2;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;font-family:'Poppins',Helvetica,Arial,sans-serif;color:#20201f;">
  <tr><td style="padding:0 8px 20px;font-size:22px;font-weight:700;letter-spacing:3px;">HAU</td></tr>
  <tr><td style="background:#ffffff;border:1px solid #e8e8e8;border-radius:24px;padding:36px 36px 32px;">
    <h1 style="margin:0 0 8px;font-size:24px;line-height:1.3;font-weight:600;">${escape(copy.title)}</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a4a4a;">${copy.lead}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
    <p style="margin:12px 0 4px;font-size:14px;color:#6c6c6c;">Do zapłaty: <strong style="color:#20201f;">${money(order.totalCents)}</strong></p>
    <p style="margin:12px 0 24px;font-size:14px;line-height:1.6;color:#4a4a4a;">${copy.note}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#20201f;border-radius:999px;">
      <a href="${kind === 'cancelled' ? absoluteUrl('/') : payLink}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${escape(copy.cta)}</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:20px 16px 0;font-size:12px;line-height:1.6;color:#8e8e8e;text-align:center;">
    Pytania? Odpowiedz na tę wiadomość.<br><a href="${absoluteUrl('/')}" style="color:#8e8e8e;">e-hau.pl</a>
  </td></tr>
</table></td></tr></table>
</body></html>`

  try {
    return await sendMail({ to: email, subject: copy.subject, html })
  } catch (error) {
    console.error('[orderEmails] unpaid order mail failed', { orderId, kind, error })
    return false
  }
}
