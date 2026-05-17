import 'server-only'
import { redis } from '@/lib/redis'

const IS_PROD = process.env.NODE_ENV === 'production'

// sandbox: wszystko na api.sandbox.furgonetka.pl
// prod:    wszystko na api.furgonetka.pl
const BASE_URL = IS_PROD
  ? 'https://api.furgonetka.pl'
  : 'https://api.sandbox.furgonetka.pl'

const CLIENT_ID     = process.env.FURGONETKA_CLIENT_ID!
const CLIENT_SECRET = process.env.FURGONETKA_CLIENT_SECRET!
const REDIRECT_URI  = process.env.FURGONETKA_REDIRECT_URI!

const REDIS_ACCESS_TOKEN  = 'furgonetka:access_token'
const REDIS_REFRESH_TOKEN = 'furgonetka:refresh_token'

// ─── OAuth URLs ───────────────────────────────────────────────────────────────

export function getAuthorizeUrl(): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    scope:         'api',
  })
  return `${BASE_URL}/oauth/authorize?${params}`
}

// ─── token exchange (one-time setup) ─────────────────────────────────────────

function basicAuthHeader(): string {
  return 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token:  string
  refresh_token: string
  expires_in:    number
}> {
  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': basicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type:   'authorization_code',
      redirect_uri: REDIRECT_URI,
      code,
    }),
  })

  if (!res.ok) {
    throw new Error(`Furgonetka token exchange failed: ${res.status} ${await res.text()}`)
  }

  return res.json()
}

// ─── access token (via refresh token) ────────────────────────────────────────

async function getRefreshToken(): Promise<string> {
  // prefer Redis (set after OAuth dance), fallback to env
  const fromRedis = await redis.get(REDIS_REFRESH_TOKEN)
  if (fromRedis) return fromRedis as string

  const fromEnv = process.env.FURGONETKA_REFRESH_TOKEN
  if (fromEnv) return fromEnv

  throw new Error(
    'Furgonetka refresh token not found. Run /api/furgonetka/connect to authorize.',
  )
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = await getRefreshToken()

  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': basicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    throw new Error(`Furgonetka token refresh failed: ${res.status} ${await res.text()}`)
  }

  const data: { access_token: string; refresh_token?: string; expires_in: number } =
    await res.json()

  // cache new access token
  await redis.setEx(REDIS_ACCESS_TOKEN, data.expires_in - 60, data.access_token)

  // if provider rotates refresh token, persist the new one
  if (data.refresh_token) {
    await redis.set(REDIS_REFRESH_TOKEN, data.refresh_token)
  }

  return data.access_token
}

async function getAccessToken(): Promise<string> {
  const cached = await redis.get(REDIS_ACCESS_TOKEN)
  if (cached) return cached as string
  return refreshAccessToken()
}

// ─── base fetch ───────────────────────────────────────────────────────────────

export async function furgonetkaFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()

  const isWrite = init.method === 'POST' || init.method === 'PUT' || init.method === 'PATCH'

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(isWrite ? { 'Content-Type': 'application/json' } : {}),
      'Accept':      'application/vnd.furgonetka.v1+json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  })

  const body = await res.json()
  if (!res.ok) {
    throw new Error(`Furgonetka ${res.status} at ${path}: ${JSON.stringify(body)}`)
  }
  return body as T
}

// ─── types ────────────────────────────────────────────────────────────────────

export interface FurgonetkaParcel {
  weightKg: number
  widthCm:  number
  heightCm: number
  depthCm:  number
}

export interface FurgonetkaAddress {
  firstName:  string
  lastName:   string
  email:      string
  phone:      string
  street:     string
  city:       string
  postalCode: string
  country:    'PL'
}

export interface FurgonetkaService {
  id:          number
  code:        string  // e.g. "dpd", "inpost", "dhl"
  name:        string  // e.g. "DPD", "InPost"
  pricelistId: number
  priceCents:  number | null  // null until fetched from pricelist endpoint
}

export interface FurgonetkaShipmentResult {
  id:             string
  trackingNumber: string | null
  carrier:        string
  status:         string
}

// ─── services (cached 1h) ─────────────────────────────────────────────────────

const SERVICES_REDIS_KEY = 'furgonetka:services'

export async function getAvailableServices(): Promise<FurgonetkaService[]> {
  const cached = await redis.get(SERVICES_REDIS_KEY)
  if (cached) return JSON.parse(cached as string)

  const data = await furgonetkaFetch<{
    services: Array<{ id: number; service: string; name: string; pricelist_id: number }>
  }>('/account/services')

  const services: FurgonetkaService[] = data.services.map(s => ({
    id:          s.id,
    code:        s.service,
    name:        s.name,
    pricelistId: s.pricelist_id,
    priceCents:  null,
  }))

  await redis.setEx(SERVICES_REDIS_KEY, 60 * 60, JSON.stringify(services))
  return services
}

export async function getServicePrice(serviceCode: string): Promise<number> {
  const services = await getAvailableServices()
  const service  = services.find(s => s.code === serviceCode)
  if (!service) throw new Error(`Unknown Furgonetka service: ${serviceCode}`)
  // priceCents is null until a pricing endpoint is integrated —
  // caller must validate before use
  return service.priceCents ?? 0
}

// ─── shipment ─────────────────────────────────────────────────────────────────

export interface CreateShipmentParams {
  service:     string
  parcel:      FurgonetkaParcel
  recipient:   FurgonetkaAddress
  reference:   string
  description: string
}

export async function createShipment(params: CreateShipmentParams): Promise<FurgonetkaShipmentResult> {
  const result = await furgonetkaFetch<{
    id:              string
    tracking_number: string | null
    carrier:         string
    status:          string
  }>('/packages', {
    method: 'POST',
    body: JSON.stringify({
      service: params.service,
      parcels: [{
        weight: params.parcel.weightKg,
        width:  params.parcel.widthCm,
        height: params.parcel.heightCm,
        depth:  params.parcel.depthCm,
      }],
      receiver: {
        first_name:   params.recipient.firstName,
        last_name:    params.recipient.lastName,
        email:        params.recipient.email,
        phone:        params.recipient.phone,
        street:       params.recipient.street,
        city:         params.recipient.city,
        post_code:    params.recipient.postalCode,
        country_code: params.recipient.country,
      },
      reference:   params.reference,
      description: params.description,
    }),
  })

  return {
    id:             result.id,
    trackingNumber: result.tracking_number,
    carrier:        result.carrier,
    status:         result.status,
  }
}

export async function getShipmentLabel(furgonetkaId: string): Promise<string> {
  const result = await furgonetkaFetch<{ url: string }>(`/packages/${furgonetkaId}/waybills`)
  return result.url
}

export async function getShipment(furgonetkaId: string): Promise<FurgonetkaShipmentResult> {
  const result = await furgonetkaFetch<{
    id:              string
    tracking_number: string | null
    carrier:         string
    status:          string
  }>(`/packages/${furgonetkaId}`)

  return {
    id:             result.id,
    trackingNumber: result.tracking_number,
    carrier:        result.carrier,
    status:         result.status,
  }
}
