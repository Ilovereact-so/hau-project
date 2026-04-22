import 'server-only'
import { createHash } from 'crypto'

const IS_PROD    = process.env.NODE_ENV === 'production'
const BASE_URL   = IS_PROD ? 'https://secure.przelewy24.pl' : 'https://sandbox.przelewy24.pl'
const MERCHANT_ID = Number(process.env.P24_MERCHANT_ID!)
const POS_ID      = Number(process.env.P24_POS_ID!)
const API_KEY     = process.env.P24_API_KEY!
const CRC_KEY     = process.env.P24_CRC_KEY!

// SHA384 over JSON-stringified object — key order must match P24 spec exactly
function sign(params: Record<string, string | number>): string {
  return createHash('sha384').update(JSON.stringify(params)).digest('hex')
}

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${POS_ID}:${API_KEY}`).toString('base64')
}

async function p24Fetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
      ...init.headers,
    },
  })

  const body = await res.json()
  if (!res.ok) {
    throw new Error(`P24 ${res.status} at ${path}: ${JSON.stringify(body)}`)
  }
  return body as T
}

// ─── register ─────────────────────────────────────────────────────────────────

export interface P24RegisterParams {
  sessionId:   string // we use orderId as sessionId
  amount:      number // grosz
  currency:    'PLN'
  description: string
  email:       string
  urlReturn:   string // where to redirect user after payment
  urlStatus:   string // our webhook
  timeLimit?:  number // minutes until expiry (1-99, 0 = no limit)
}

export interface P24RegisterResult {
  token:       string
  redirectUrl: string
}

export async function registerTransaction(params: P24RegisterParams): Promise<P24RegisterResult> {
  const signature = sign({
    sessionId:  params.sessionId,
    merchantId: MERCHANT_ID,
    amount:     params.amount,
    currency:   params.currency,
    crc:        CRC_KEY,
  })

  const body = await p24Fetch<{ data: { token: string } }>('/api/v1/transaction/register', {
    method: 'POST',
    body: JSON.stringify({
      merchantId:  MERCHANT_ID,
      posId:       POS_ID,
      sessionId:   params.sessionId,
      amount:      params.amount,
      currency:    params.currency,
      description: params.description,
      email:       params.email,
      country:     'PL',
      language:    'pl',
      urlReturn:   params.urlReturn,
      urlStatus:   params.urlStatus,
      timeLimit:   params.timeLimit ?? 15,
      sign:        signature,
    }),
  })

  return {
    token:       body.data.token,
    redirectUrl: `${BASE_URL}/trnRequest/${body.data.token}`,
  }
}

// ─── verify ───────────────────────────────────────────────────────────────────

export interface P24VerifyParams {
  sessionId: string
  orderId:   number // P24's numeric orderId from the IPN
  amount:    number
  currency:  'PLN'
}

export async function verifyTransaction(params: P24VerifyParams): Promise<void> {
  const signature = sign({
    sessionId: params.sessionId,
    orderId:   params.orderId,
    amount:    params.amount,
    currency:  params.currency,
    crc:       CRC_KEY,
  })

  await p24Fetch('/api/v1/transaction/verify', {
    method: 'PUT',
    body: JSON.stringify({
      merchantId: MERCHANT_ID,
      posId:      POS_ID,
      sessionId:  params.sessionId,
      amount:     params.amount,
      currency:   params.currency,
      orderId:    params.orderId,
      sign:       signature,
    }),
  })
}

// ─── IPN (webhook) signature verification ─────────────────────────────────────

export interface P24IPN {
  merchantId:   number
  posId:        number
  sessionId:    string
  amount:       number
  originAmount: number
  currency:     string
  orderId:      number
  methodId:     number
  statement:    string
  sign:         string
}

export function verifyIPN(payload: P24IPN): boolean {
  const expected = sign({
    merchantId:   payload.merchantId,
    posId:        payload.posId,
    sessionId:    payload.sessionId,
    amount:       payload.amount,
    originAmount: payload.originAmount,
    currency:     payload.currency,
    orderId:      payload.orderId,
    methodId:     payload.methodId,
    statement:    payload.statement,
    crc:          CRC_KEY,
  })
  return expected === payload.sign
}
