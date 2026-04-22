import 'server-only'
import { createHash } from 'crypto'

const SERVICE_ID = process.env.AUTOPAY_SERVICE_ID!
const HASH_KEY   = process.env.AUTOPAY_HASH_KEY!
const BASE_URL   = process.env.NODE_ENV === 'production'
  ? 'https://pay.autopay.eu'
  : 'https://testpay.autopay.eu'

function sha256(...parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex')
}

// ─── initiate ─────────────────────────────────────────────────────────────────

export interface AutopayPaymentParams {
  orderId:       string
  amount:        string  // "123.45" — PLN z groszami
  description:   string
  customerEmail: string
  urlReturn:     string  // where to redirect after payment
  urlStatus:     string  // our webhook
}

export interface AutopayPaymentResult {
  redirectUrl: string
}

export function createPaymentUrl(params: AutopayPaymentParams): AutopayPaymentResult {
  const hash = sha256(
    SERVICE_ID,
    params.orderId,
    params.amount,
    params.description,
    params.urlReturn,
    HASH_KEY,
  )

  const query = new URLSearchParams({
    ServiceID:     SERVICE_ID,
    OrderID:       params.orderId,
    Amount:        params.amount,
    Description:   params.description,
    CustomerEmail: params.customerEmail,
    GatewayUrl:    params.urlReturn,
    NotificationUrl: params.urlStatus,
    Hash:          hash,
  })

  return { redirectUrl: `${BASE_URL}/payment?${query.toString()}` }
}

// ─── ITN (webhook) ────────────────────────────────────────────────────────────

export interface AutopayITN {
  ServiceID:     string
  OrderID:       string
  RemoteID:      string
  Amount:        string
  Currency:      string
  GatewayID:     string
  PaymentDate:   string
  PaymentStatus: 'SUCCESS' | 'FAILURE' | 'PENDING'
  Hash:          string
}

export function verifyITN(payload: AutopayITN): boolean {
  const expected = sha256(
    payload.ServiceID,
    payload.OrderID,
    payload.RemoteID,
    payload.Amount,
    payload.Currency,
    payload.GatewayID,
    payload.PaymentDate,
    payload.PaymentStatus,
    HASH_KEY,
  )
  return expected === payload.Hash
}

export function buildITNConfirmation(orderId: string): string {
  const hash = sha256(SERVICE_ID, orderId, 'CONFIRMED', HASH_KEY)
  return JSON.stringify({ ServiceID: SERVICE_ID, OrderID: orderId, Hash: hash })
}
