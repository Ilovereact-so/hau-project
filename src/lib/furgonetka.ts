import 'server-only'
import { redis } from '@/lib/redis'

const BASE_URL      = 'https://api.furgonetka.pl'
const CLIENT_ID     = process.env.FURGONETKA_CLIENT_ID!
const CLIENT_SECRET = process.env.FURGONETKA_CLIENT_SECRET!
const ACCOUNT_ID    = process.env.FURGONETKA_ACCOUNT_ID!

const TOKEN_REDIS_KEY = 'furgonetka:access_token'

// ─── auth ─────────────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const cached = await redis.get(TOKEN_REDIS_KEY)
  if (cached) return cached as string

  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope:         'api',
    }),
  })

  if (!res.ok) {
    throw new Error(`Furgonetka auth failed: ${res.status} ${await res.text()}`)
  }

  const data: { access_token: string; expires_in: number } = await res.json()
  // cache with 60s safety margin
  await redis.setEx(TOKEN_REDIS_KEY, data.expires_in - 60, data.access_token)
  return data.access_token
}

async function furgonetkaFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
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
  code:        string
  name:        string
  carrier:     string
  priceCents:  number // grosz
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
    services: Array<{ code: string; name: string; carrier: string; price: number }>
  }>('/v1/services')

  const services: FurgonetkaService[] = data.services.map(s => ({
    code:       s.code,
    name:       s.name,
    carrier:    s.carrier,
    priceCents: Math.round(s.price * 100),
  }))

  await redis.setEx(SERVICES_REDIS_KEY, 60 * 60, JSON.stringify(services))
  return services
}

export async function getServicePrice(serviceCode: string): Promise<number> {
  const services = await getAvailableServices()
  const service  = services.find(s => s.code === serviceCode)
  if (!service) throw new Error(`Unknown Furgonetka service: ${serviceCode}`)
  return service.priceCents
}

// ─── shipment ─────────────────────────────────────────────────────────────────

export interface CreateShipmentParams {
  service:     string
  parcel:      FurgonetkaParcel
  recipient:   FurgonetkaAddress
  reference:   string // our order ID
  description: string
}

export async function createShipment(params: CreateShipmentParams): Promise<FurgonetkaShipmentResult> {
  const result = await furgonetkaFetch<{
    id: string
    tracking_number: string | null
    carrier: string
    status:  string
  }>('/v1/packages', {
    method: 'POST',
    body: JSON.stringify({
      account_id: ACCOUNT_ID,
      service:    params.service,
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
  const result = await furgonetkaFetch<{ url: string }>(`/v1/packages/${furgonetkaId}/waybills`)
  return result.url
}

export async function getShipment(furgonetkaId: string): Promise<FurgonetkaShipmentResult> {
  const result = await furgonetkaFetch<{
    id: string
    tracking_number: string | null
    carrier: string
    status:  string
  }>(`/v1/packages/${furgonetkaId}`)

  return {
    id:             result.id,
    trackingNumber: result.tracking_number,
    carrier:        result.carrier,
    status:         result.status,
  }
}
