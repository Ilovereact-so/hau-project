import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orderItems, orders, shippingAddresses } from '@/db/schema'
import { sendMail } from '@/lib/mail'
import { absoluteUrl } from '@/lib/site'
import { guestOrderPath } from '@/lib/orderAccess'

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
      ${awaitingPayment ? 'Czekamy na potwierdzenie płatności — jeśli nie udało się jej dokończyć, możesz wrócić do zamówienia z linku poniżej.' : 'Zajmiemy się nim najszybciej, jak to możliwe.'}
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
      <a href="${link}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Sprawdź status zamówienia</a>
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
