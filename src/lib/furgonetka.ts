import 'server-only'
import { redis } from '@/lib/redis'

import { FURGONETKA_API_URL } from '@/lib/furgonetkaEnv'

// sandbox: wszystko na api.sandbox.furgonetka.pl
// prod:    wszystko na api.furgonetka.pl
// Wybór środowiska: NEXT_PUBLIC_FURGONETKA_ENV (patrz lib/furgonetkaEnv.ts).
const BASE_URL = FURGONETKA_API_URL

const CLIENT_ID     = process.env.FURGONETKA_CLIENT_ID!
const CLIENT_SECRET = process.env.FURGONETKA_CLIENT_SECRET!
const REDIRECT_URI  = process.env.FURGONETKA_REDIRECT_URI?.trim() || ''

const REDIS_ACCESS_TOKEN  = 'furgonetka:access_token'
const REDIS_REFRESH_TOKEN = 'furgonetka:refresh_token'
const REDIS_OAUTH_REDIRECT = 'furgonetka:oauth_redirect_uri'

// ─── OAuth: adres przekierowania ──────────────────────────────────────────────
//
// Furgonetka przyjmuje autoryzację TYLKO z adresem przekierowania zapisanym
// w jej aplikacji OAuth — każdy inny kończy się od razu `invalid_client`
// (bez logowania i bez przekierowania). Aplikacja HAU była zakładana lokalnie,
// więc ma zarejestrowany adres localhost. Adres wybiera się w /admin/settings
// (zapamiętany w Redisie), bez edycji .env i restartu; FURGONETKA_REDIRECT_URI
// to tylko wartość zapasowa.

/** Adres zarejestrowany przy zakładaniu aplikacji HAU (z lokalnego .env). */
export const DEFAULT_OAUTH_REDIRECT_URI = 'http://localhost:3000/api/furgonetka/callback'

/** Adres przekierowania bez zapytania i kotwicy; `null`, gdy to nie jest adres http(s). */
export function normalizeRedirectUri(raw: string): string | null {
  try {
    const url = new URL(String(raw ?? '').trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return `${url.origin}${url.pathname}`
  } catch {
    return null
  }
}

/** Adres zapamiętany przy ostatniej autoryzacji z panelu. */
export async function getSavedOAuthRedirectUri(): Promise<string | null> {
  try {
    return ((await redis.get(REDIS_OAUTH_REDIRECT)) as string | null) || null
  } catch {
    return null // Redis niedostępny — wartość zapasowa
  }
}

/** Adres użyty przy ostatniej autoryzacji z panelu (albo z .env). */
export async function getOAuthRedirectUri(): Promise<string> {
  return (await getSavedOAuthRedirectUri()) || REDIRECT_URI || DEFAULT_OAUTH_REDIRECT_URI
}

export async function setOAuthRedirectUri(uri: string): Promise<void> {
  await redis.set(REDIS_OAUTH_REDIRECT, uri)
}

// ─── OAuth URLs ───────────────────────────────────────────────────────────────

export function getAuthorizeUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    redirect_uri:  redirectUri,
    scope:         'api',
  })
  return `${BASE_URL}/oauth/authorize?${params}`
}

// ─── token exchange (one-time setup) ─────────────────────────────────────────

function basicAuthHeader(): string {
  return 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
}

// `redirectUri` MUSI być identyczny z tym z /oauth/authorize.
export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
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
      redirect_uri: redirectUri,
      code,
    }),
  })

  if (!res.ok) {
    throw new Error(`Furgonetka token exchange failed: ${res.status} ${await res.text()}`)
  }

  return res.json()
}

/** Zapisuje tokeny z autoryzacji — aplikacja korzysta z nich od razu. */
export async function saveFurgonetkaTokens(tokens: { access_token: string; refresh_token: string; expires_in: number }) {
  await Promise.all([
    redis.setEx(REDIS_ACCESS_TOKEN, tokens.expires_in - 60, tokens.access_token),
    redis.set(REDIS_REFRESH_TOKEN, tokens.refresh_token),
  ])
}

/**
 * Kończy autoryzację z WKLEJONEGO adresu (albo samego kodu). Aplikacja OAuth
 * w Furgonetce ma zarejestrowany adres przekierowania `localhost` — Furgonetka
 * nie przyjmie innego (`invalid_client`), więc na serwerze po zatwierdzeniu
 * przeglądarka ląduje na niedziałającym `localhost…?code=…`. Admin wkleja ten
 * adres w /admin/settings, a serwer wymienia kod (ważny kilka minut).
 */
export async function connectWithPastedCode(input: string): Promise<void> {
  const raw = input.trim()
  if (!raw) throw new Error('Wklej adres z paska przeglądarki albo sam kod.')

  let code = raw
  // Adres wymiany = dokładnie ten, na który Furgonetka przekierowała (bierzemy
  // go z wklejonego linku), więc zawsze zgadza się z tym z /oauth/authorize.
  let redirectUri: string | null = null
  if (/^https?:\/\//i.test(raw) || raw.includes('code=')) {
    let params: URLSearchParams
    try {
      params = /^https?:\/\//i.test(raw) ? new URL(raw).searchParams : new URLSearchParams(raw.split('?').pop())
    } catch {
      throw new Error('To nie wygląda na poprawny adres.')
    }
    const error = params.get('error')
    if (error) throw new Error(`Furgonetka odrzuciła autoryzację: ${params.get('error_description') || error}`)
    code = params.get('code') ?? ''
    if (!code) {
      throw new Error(
        'W adresie nie ma parametru code. Jeśli strona Furgonetki pokazała „invalid_client”, adres przekierowania nie zgadza się z zarejestrowanym — popraw go w polu obok „Autoryzuj konto”.',
      )
    }
    if (/^https?:\/\//i.test(raw)) redirectUri = normalizeRedirectUri(raw)
  }
  redirectUri ??= await getOAuthRedirectUri()

  let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>
  try {
    tokens = await exchangeCodeForTokens(code, redirectUri)
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err)
    if (text.includes('invalid_grant')) {
      throw new Error('Kod wygasł albo został już użyty — kliknij „Autoryzuj konto” jeszcze raz i wklej nowy adres od razu.')
    }
    if (text.includes('invalid_client')) {
      throw new Error('Furgonetka odrzuciła dane aplikacji (client id / secret albo adres przekierowania).')
    }
    throw err
  }
  await saveFurgonetkaTokens(tokens)
}

// ─── access token (via refresh token) ────────────────────────────────────────

// Źródła refresh tokena w kolejności: Redis (po autoryzacji w panelu i po
// każdej rotacji), potem FURGONETKA_REFRESH_TOKEN z .env.
async function refreshTokenCandidates(): Promise<{ token: string; source: 'redis' | 'env' }[]> {
  const out: { token: string; source: 'redis' | 'env' }[] = []
  const fromRedis = (await redis.get(REDIS_REFRESH_TOKEN)) as string | null
  if (fromRedis) out.push({ token: fromRedis, source: 'redis' })
  const fromEnv = process.env.FURGONETKA_REFRESH_TOKEN?.trim()
  if (fromEnv && fromEnv !== fromRedis) out.push({ token: fromEnv, source: 'env' })
  return out
}

export const FURGONETKA_REAUTH_MESSAGE =
  'Token Furgonetki wygasł lub został unieważniony — w /admin/settings kliknij „Autoryzuj konto”.'

async function refreshAccessToken(): Promise<string> {
  const candidates = await refreshTokenCandidates()
  if (!candidates.length) {
    throw new Error(`Brak refresh tokena Furgonetki. ${FURGONETKA_REAUTH_MESSAGE}`)
  }

  for (const { token, source } of candidates) {
    const res = await fetch(`${BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': basicAuthHeader(),
      },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: token,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      // Martwy token (wygasły / już zrotowany). Ten z Redisa usuwamy — inaczej
      // miałby pierwszeństwo przed świeżym FURGONETKA_REFRESH_TOKEN z .env
      // i blokował integrację na zawsze. Próbujemy następnego źródła.
      if (res.status === 400 && text.includes('invalid_grant')) {
        if (source === 'redis') await redis.del(REDIS_REFRESH_TOKEN)
        continue
      }
      throw new Error(`Furgonetka token refresh failed: ${res.status} ${text}`)
    }

    const data: { access_token: string; refresh_token?: string; expires_in: number } =
      await res.json()

    // cache new access token
    await redis.setEx(REDIS_ACCESS_TOKEN, data.expires_in - 60, data.access_token)

    // Furgonetka rotuje refresh token — stary przestaje działać, więc nowy
    // MUSI trafić do Redisa (z .env po pierwszym użyciu nie da się korzystać).
    if (data.refresh_token) {
      await redis.set(REDIS_REFRESH_TOKEN, data.refresh_token)
    }

    return data.access_token
  }

  throw new Error(FURGONETKA_REAUTH_MESSAGE)
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
//
// POST /packages wymaga: `service_id` (LICZBOWE id usługi z /account/services —
// w Sanity `furgonetka_service_id` trzyma KOD, np. "dpd"), `type`, `pickup`
// (adres nadawcy = sklepu), `receiver` z `name` i `postcode`, `parcels`.
// Adres nadawcy ustawia się w /admin/settings (Redis), zapasowo z .env.

const REDIS_SENDER = 'furgonetka:sender'

export interface FurgonetkaSender {
  name:     string
  company:  string
  street:   string
  postcode: string
  city:     string
  email:    string
  phone:    string
}

const SENDER_FIELDS = ['name', 'company', 'street', 'postcode', 'city', 'email', 'phone'] as const

function senderFromEnv(): FurgonetkaSender {
  const env = (key: string) => process.env[`FURGONETKA_SENDER_${key.toUpperCase()}`]?.trim() ?? ''
  return Object.fromEntries(SENDER_FIELDS.map((key) => [key, env(key)])) as unknown as FurgonetkaSender
}

/** Adres nadawcy z panelu (Redis), a gdy go nie ma — z .env. */
export async function getSenderAddress(): Promise<FurgonetkaSender> {
  try {
    const saved = (await redis.get(REDIS_SENDER)) as string | null
    if (saved) return { ...senderFromEnv(), ...JSON.parse(saved) }
  } catch {
    // Redis niedostępny — wartość z .env
  }
  return senderFromEnv()
}

export function normalizePostcode(raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits.length === 5 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : String(raw ?? '').trim()
}

/** Braki w adresie nadawcy (puste = komplet). Firma albo imię i nazwisko. */
export function senderProblems(sender: FurgonetkaSender): string[] {
  const missing: string[] = []
  if (!sender.name && !sender.company) missing.push('nazwa / imię i nazwisko')
  if (!sender.street) missing.push('ulica')
  if (!/^\d{2}-\d{3}$/.test(normalizePostcode(sender.postcode))) missing.push('kod pocztowy (00-000)')
  if (!sender.city) missing.push('miasto')
  if (!/^\S+@\S+\.\S+$/.test(sender.email)) missing.push('e-mail')
  if (sender.phone.replace(/\D/g, '').length < 9) missing.push('telefon')
  return missing
}

export async function setSenderAddress(input: Partial<FurgonetkaSender>): Promise<FurgonetkaSender> {
  const sender = Object.fromEntries(
    SENDER_FIELDS.map((key) => [key, String(input[key] ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)]),
  ) as unknown as FurgonetkaSender
  sender.postcode = normalizePostcode(sender.postcode)
  const missing = senderProblems(sender)
  if (missing.length) throw new Error(`Uzupełnij adres nadawcy: ${missing.join(', ')}.`)
  await redis.set(REDIS_SENDER, JSON.stringify(sender))
  return sender
}

/**
 * Kod usługi (np. "dpd", "inpostkurier") albo liczbowe id → `service_id`.
 * Lista usług konta jest w cache 1 h.
 */
export async function resolveServiceId(serviceCode: string): Promise<{ id: number; code: string }> {
  const code = serviceCode.trim()
  if (/^\d+$/.test(code)) return { id: Number(code), code }
  const services = await getAvailableServices()
  const lower = code.toLowerCase()
  const match =
    services.find((s) => s.code.toLowerCase() === lower) ??
    services.find((s) => s.name.toLowerCase() === lower)
  if (!match) {
    const known = services.map((s) => s.code).join(', ') || 'brak usług na koncie'
    throw new Error(`Furgonetka nie zna usługi „${code}”. Dostępne na koncie: ${known}.`)
  }
  return { id: match.id, code: match.code }
}

export interface CreateShipmentParams {
  service:     string
  parcel:      FurgonetkaParcel
  recipient:   FurgonetkaAddress
  reference:   string
  description: string
}

const phoneDigits = (raw: string) => String(raw ?? '').replace(/[^\d+]/g, '')

export async function createShipment(params: CreateShipmentParams): Promise<FurgonetkaShipmentResult> {
  const sender = await getSenderAddress()
  const missing = senderProblems(sender)
  if (missing.length) {
    throw new Error(`Brak adresu nadawcy (${missing.join(', ')}) — uzupełnij go w Ustawieniach → Integracje → Furgonetka.`)
  }
  const service = await resolveServiceId(params.service)
  const receiverName = `${params.recipient.firstName} ${params.recipient.lastName}`.trim()

  const result = await furgonetkaFetch<{
    package_id?:  number | string
    id?:          number | string
    service?:     string
    state?:       string
    status?:      string
    parcels?:     Array<{ package_no?: string | null }>
    tracking_number?: string | null
  }>('/packages', {
    method: 'POST',
    body: JSON.stringify({
      service_id: service.id,
      type:       'package',
      pickup: {
        name:         sender.name,
        company:      sender.company,
        street:       sender.street,
        postcode:     normalizePostcode(sender.postcode),
        city:         sender.city,
        country_code: 'PL',
        email:        sender.email,
        phone:        phoneDigits(sender.phone),
      },
      receiver: {
        name:         receiverName,
        company:      '',
        street:       params.recipient.street,
        postcode:     normalizePostcode(params.recipient.postalCode),
        city:         params.recipient.city,
        country_code: params.recipient.country,
        email:        params.recipient.email,
        phone:        phoneDigits(params.recipient.phone),
      },
      parcels: [{
        weight:      params.parcel.weightKg,
        width:       params.parcel.widthCm,
        height:      params.parcel.heightCm,
        depth:       params.parcel.depthCm,
        description: params.description,
      }],
      user_reference_number: params.reference,
    }),
  })

  return {
    id:             String(result.package_id ?? result.id ?? ''),
    trackingNumber: result.parcels?.[0]?.package_no ?? result.tracking_number ?? null,
    carrier:        result.service || service.code,
    status:         result.state ?? result.status ?? 'created',
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
