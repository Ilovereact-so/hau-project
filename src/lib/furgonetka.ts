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
//
// Furgonetka wybiera wersję operacji z typu mediów (`application/vnd.furgonetka.vN+json`)
// w `Accept` i `Content-Type` — nieznana wersja jest po cichu ignorowana. Wersje
// operacji (stan ze specyfikacji): POST /packages, GET /packages/{id}, tracking — v2;
// reszta — v1.

const mediaType = (version: number) => `application/vnd.furgonetka.v${version}+json`

async function furgonetkaRequest(path: string, init: RequestInit & { version?: number; accept?: string } = {}): Promise<Response> {
  const token = await getAccessToken()
  const { version = 1, accept, ...rest } = init
  const hasBody = rest.body !== undefined && rest.body !== null
  return fetch(`${BASE_URL}${path}`, {
    ...rest,
    cache: 'no-store',
    headers: {
      ...(hasBody ? { 'Content-Type': mediaType(version) } : {}),
      Accept: accept ?? mediaType(version),
      Authorization: `Bearer ${token}`,
      ...rest.headers,
    },
  })
}

export async function furgonetkaFetch<T>(path: string, init: RequestInit & { version?: number } = {}): Promise<T> {
  const res = await furgonetkaRequest(path, init)
  const text = await res.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text.slice(0, 500)
    }
  }
  if (!res.ok) {
    throw new Error(`Furgonetka ${res.status} at ${path}: ${typeof body === 'string' ? body : JSON.stringify(body)}`)
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
// POST /packages (v2) wymaga: `service_id` (LICZBOWE id usługi z /account/services —
// w Sanity `furgonetka_service_id` trzyma KOD, np. "dpd"), `type`, `pickup`
// (skąd kurier odbiera), `receiver` z `name` i `postcode`, `parcels`.
// Adres odbioru to wpis z KSIĄŻKI ADRESOWEJ Furgonetki wybrany w /admin/settings
// (Redis `furgonetka:pickup_address_id`); bez wyboru — wpis oznaczony w Furgonetce
// jako domyślny adres odbioru; na końcu zapas z .env (FURGONETKA_SENDER_*).

const REDIS_PICKUP_ID = 'furgonetka:pickup_address_id'

export interface FurgonetkaSender {
  name:     string
  company:  string
  street:   string
  postcode: string
  city:     string
  email:    string
  phone:    string
}

export interface FurgonetkaAddressEntry extends FurgonetkaSender {
  id:            number
  defaultPickup: boolean
}

const SENDER_FIELDS = ['name', 'company', 'street', 'postcode', 'city', 'email', 'phone'] as const

function senderFromEnv(): FurgonetkaSender {
  const env = (key: string) => process.env[`FURGONETKA_SENDER_${key.toUpperCase()}`]?.trim() ?? ''
  return Object.fromEntries(SENDER_FIELDS.map((key) => [key, env(key)])) as unknown as FurgonetkaSender
}

type RawAddressEntry = {
  id?: number
  full_name?: string | null
  name?: string | null
  surname?: string | null
  company?: string | null
  street?: string | null
  building_number?: string | null
  flat_number?: string | null
  postcode?: string | null
  city?: string | null
  email?: string | null
  phone?: string | null
  point?: string | null
  default_pickup?: boolean | null
}

function mapAddressEntry(raw: RawAddressEntry): FurgonetkaAddressEntry {
  const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
  let street = str(raw.street)
  const building = str(raw.building_number)
  const flat = str(raw.flat_number)
  if (building && !street.includes(building)) street = `${street} ${building}`.trim()
  if (flat && !street.endsWith(flat)) street = `${street}/${flat}`
  return {
    id: Number(raw.id),
    name: str(raw.full_name) || `${str(raw.name)} ${str(raw.surname)}`.trim(),
    company: str(raw.company),
    street,
    postcode: str(raw.postcode),
    city: str(raw.city),
    email: str(raw.email),
    phone: str(raw.phone),
    defaultPickup: raw.default_pickup === true,
  }
}

/** Książka adresowa konta (bez adresów punktów odbioru — kurier nie odbierze z paczkomatu). */
export async function listAddressBook(): Promise<FurgonetkaAddressEntry[]> {
  const entries: FurgonetkaAddressEntry[] = []
  for (let page = 1; page <= 10; page++) {
    const data = await furgonetkaFetch<{ address_book_entries?: RawAddressEntry[]; total_pages?: number }>(
      `/account/address-book?page=${page}`,
    )
    for (const raw of data?.address_book_entries ?? []) {
      if (raw?.id && !raw.point) entries.push(mapAddressEntry(raw))
    }
    if (!data?.total_pages || page >= data.total_pages) break
  }
  return entries
}

export async function getPickupAddressId(): Promise<number | null> {
  try {
    const value = Number(await redis.get(REDIS_PICKUP_ID))
    return Number.isInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export async function setPickupAddressId(id: number | null): Promise<void> {
  if (id === null) await redis.del(REDIS_PICKUP_ID)
  else await redis.set(REDIS_PICKUP_ID, String(id))
}

/** Adres odbioru przesyłek: wybrany wpis książki → domyślny adres odbioru z Furgonetki → .env. */
export async function getSenderAddress(): Promise<FurgonetkaSender> {
  const id = await getPickupAddressId()
  if (id) {
    const raw = await furgonetkaFetch<RawAddressEntry>(`/account/address-book/${id}`)
    return mapAddressEntry(raw)
  }
  const fallback = senderFromEnv()
  if (!senderProblems(fallback).length) return fallback
  const book = await listAddressBook()
  return book.find((entry) => entry.defaultPickup) ?? (book.length === 1 ? book[0] : fallback)
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
    throw new Error(`Adres odbioru przesyłek jest niepełny (${missing.join(', ')}) — wybierz adres z książki adresowej w Ustawieniach → Integracje → Furgonetka albo uzupełnij go w Furgonetce.`)
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
    version: 2,
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

// ─── zamówienie kuriera, etykieta, śledzenie ─────────────────────────────────

type CommandStatus = 'queueing' | 'running' | 'successful' | 'partial_success' | 'error' | 'cancelled'
type CommandResult = {
  status?: CommandStatus
  errors?: Array<{ path?: string; message?: string }>
  successfully_ordered_packages?: Array<string | number>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Zamawia przesyłkę (= kurier + etykieta; Furgonetka pobiera opłatę z salda).
 * Komenda jest asynchroniczna: PUT /order-commands/{uuid}, potem odpytywanie
 * GET aż do stanu końcowego (zwykle 1–5 s). Bez zamówienia etykiety nie ma.
 */
export async function orderShipment(furgonetkaId: string): Promise<void> {
  const uuid = crypto.randomUUID()
  await furgonetkaFetch(`/order-commands/${uuid}`, {
    method: 'PUT',
    body: JSON.stringify({
      packages: [{ id: furgonetkaId }],
      label: { file_format: 'pdf', page_format: 'a6' },
    }),
  })
  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(attempt < 5 ? 1000 : 2000)
    const result = await furgonetkaFetch<CommandResult>(`/order-commands/${uuid}`)
    if (result.status === 'successful') return
    if (result.status === 'error' || result.status === 'partial_success' || result.status === 'cancelled') {
      const errors = (result.errors ?? []).map((e) => e.message).filter(Boolean).join('; ')
      throw new Error(`Furgonetka nie zamówiła przesyłki${errors ? `: ${errors}` : ''}.`)
    }
  }
  throw new Error('Furgonetka nie potwierdziła zamówienia w 30 s — sprawdź przesyłkę w panelu Furgonetki i odśwież status.')
}

export class LabelNotReadyError extends Error {}

/**
 * Etykieta to PLIK (PDF albo ZPL/EPL jako tekst), nie JSON z adresem.
 * 204 = jeszcze nie ma (przesyłka niezamówiona albo etykieta w przygotowaniu).
 */
export async function getShipmentLabel(furgonetkaId: string): Promise<{ data: ArrayBuffer; contentType: string }> {
  const res = await furgonetkaRequest(`/packages/${encodeURIComponent(furgonetkaId)}/label`, {
    accept: `application/pdf, text/plain, ${mediaType(1)}`,
  })
  if (res.status === 204) {
    throw new LabelNotReadyError('Etykiety jeszcze nie ma — przesyłka musi być zamówiona. Spróbuj za chwilę.')
  }
  const contentType = res.headers.get('content-type') ?? ''
  if (!res.ok || contentType.includes('json')) {
    throw new Error(`Furgonetka ${res.status} przy pobieraniu etykiety: ${(await res.text()).slice(0, 500)}`)
  }
  return { data: await res.arrayBuffer(), contentType: contentType || 'application/pdf' }
}

export interface FurgonetkaPackageInfo {
  id: string
  state: string | null
  waybills: string[]
}

export async function getShipment(furgonetkaId: string): Promise<FurgonetkaPackageInfo> {
  const result = await furgonetkaFetch<{
    package_id?: string | number
    state?: string
    parcels?: Array<{ package_no?: string | null }>
  }>(`/packages/${encodeURIComponent(furgonetkaId)}`, { version: 2 })
  return {
    id: String(result.package_id ?? furgonetkaId),
    state: result.state ?? null,
    waybills: (result.parcels ?? []).map((p) => p.package_no ?? '').filter(Boolean),
  }
}

export interface TrackingEvent {
  state: string
  description: string
  datetime: string
}

/** Najświeższe zdarzenie śledzenia (po dacie — kolejność w odpowiedzi nie jest gwarantowana). */
export async function getLatestTracking(furgonetkaId: string): Promise<TrackingEvent | null> {
  const result = await furgonetkaFetch<{
    parcels?: Record<string, { tracking?: Array<{ state?: string; status?: string; datetime?: string }> }>
  }>(`/packages/${encodeURIComponent(furgonetkaId)}/tracking`, { version: 2 })
  let latest: TrackingEvent | null = null
  for (const parcel of Object.values(result?.parcels ?? {})) {
    for (const event of parcel?.tracking ?? []) {
      if (!event?.state) continue
      const candidate = { state: event.state, description: event.status ?? '', datetime: event.datetime ?? '' }
      if (!latest || candidate.datetime > latest.datetime) latest = candidate
    }
  }
  return latest
}

// ─── webhook ──────────────────────────────────────────────────────────────────
//
// Adres, format i „sól” webhooka ustawia się w panelu Furgonetki; API je zwraca
// (GET /account/settings/notification/webhook), więc sól NIE musi być w .env.
// FURGONETKA_WEBHOOK_SECRET ma pierwszeństwo, gdy jest ustawiona.

const REDIS_WEBHOOK_SALT = 'furgonetka:webhook_salt'

export interface FurgonetkaWebhookSettings {
  url: string | null
  format: string | null
  hasToken: boolean
}

async function fetchWebhookSettingsRaw(): Promise<{ url?: string | null; format?: string | null; token?: string | null }> {
  return (await furgonetkaFetch<{ url?: string | null; format?: string | null; token?: string | null }>(
    '/account/settings/notification/webhook',
  )) ?? {}
}

export async function getWebhookSettings(): Promise<FurgonetkaWebhookSettings> {
  const raw = await fetchWebhookSettingsRaw()
  if (raw.token) await redis.setEx(REDIS_WEBHOOK_SALT, 600, raw.token).catch(() => null)
  return { url: raw.url ?? null, format: raw.format ?? null, hasToken: Boolean(raw.token) }
}

/** Sól do weryfikacji powiadomień: .env → cache 10 min → API Furgonetki. */
export async function getWebhookSalt(options: { fresh?: boolean } = {}): Promise<string> {
  const fromEnv = process.env.FURGONETKA_WEBHOOK_SECRET?.trim()
  if (fromEnv) return fromEnv
  if (!options.fresh) {
    const cached = (await redis.get(REDIS_WEBHOOK_SALT).catch(() => null)) as string | null
    if (cached) return cached
  }
  const raw = await fetchWebhookSettingsRaw()
  if (raw.token) await redis.setEx(REDIS_WEBHOOK_SALT, 600, raw.token).catch(() => null)
  return raw.token ?? ''
}
