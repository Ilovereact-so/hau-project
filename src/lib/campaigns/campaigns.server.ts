import 'server-only'
import { randomBytes, randomUUID } from 'crypto'
import { and, asc, desc, eq, gte, inArray, isNotNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { newsletterCampaignRecipients, newsletterCampaigns, newsletterSubscribers, type CampaignStatus } from '@/db/schema'
import { isMailConfigured, sendMail } from '@/lib/mail'
import { redis } from '@/lib/redis'
import { sanitizeRichText } from '@/lib/richText'
import { EMAIL_LOGO_PATH } from '@/lib/emailLayout'
import { SELLER, SITE_URL, absoluteUrl } from '@/lib/site'
import { listingPrice } from '@/lib/productSort'
import { sanityClient } from '@/sanity/sanityClient.server'
import { urlFor } from '@/sanity/lib/image'
import { primaryImageForVariant } from '@/lib/variantImages'
import {
  CAMPAIGN_LIMITS,
  EMPTY_CAMPAIGN_CONTENT,
  campaignProblems,
  normalizeCampaignContent,
  renderCampaignEmail,
  type CampaignContent,
  type CampaignDraft,
  type CampaignProduct,
} from '@/lib/campaigns/content'

/*
 * Kampanie newslettera (panel: Marketing → Kampanie).
 *
 * Wysyłka:
 *  1. „Wyślij” (albo nadejście daty zaplanowanej) robi MIGAWKĘ odbiorców:
 *     aktywni subskrybenci z potwierdzonym zapisem (double opt-in) trafiają
 *     do `newsletter_campaign_recipients` ze statusem `pending`.
 *  2. `processCampaigns` wysyła partie z limitem na minutę i na dobę
 *     (NEWSLETTER_RATE_PER_MINUTE, NEWSLETTER_DAILY_LIMIT — Gmail/zwykłe
 *     skrzynki SMTP mają dobowe limity, przekroczenie blokuje konto).
 *     Uruchamiają ją: start kampanii (`after()`), otwarty panel kampanii
 *     (odpytuje postęp co kilka sekund) i zadanie cykliczne
 *     /api/cron/newsletter-campaigns. Blokada w Redisie pilnuje, żeby dwa
 *     procesy nie wysyłały naraz, a każdy odbiorca jest „zajmowany”
 *     warunkowym UPDATE — ten sam mail nie wyjdzie dwa razy.
 *  3. Przed wysyłką do odbiorcy sprawdzamy, czy nadal jest zapisany —
 *     wypisany w trakcie kampanii dostaje status `skipped`.
 *  4. Każdy mail ma link wypisania w stopce i nagłówki List-Unsubscribe
 *     (+ One-Click, RFC 8058 — wymagane przez Gmail/Yahoo dla wysyłek masowych).
 */

const DAY_MS = 24 * 60 * 60_000
const LOCK_KEY = 'newsletter:campaigns:lock:v1'
const LOCK_TTL_MS = 6 * 60_000
const MAX_ATTEMPTS = 3

const envInt = (name: string, fallback: number, min: number, max: number) => {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value >= min ? Math.min(max, Math.floor(value)) : fallback
}

/** Ile maili na minutę (domyślnie 20 — bezpiecznie dla zwykłej skrzynki SMTP). */
export const RATE_PER_MINUTE = () => envInt('NEWSLETTER_RATE_PER_MINUTE', 20, 1, 600)
/** Ile maili na dobę we wszystkich kampaniach (domyślnie 400 — poniżej limitu Gmaila). */
export const DAILY_LIMIT = () => envInt('NEWSLETTER_DAILY_LIMIT', 400, 1, 100_000)

// ─── typy ────────────────────────────────────────────────────────────────────

export type AdminCampaign = {
  id: string
  name: string
  subject: string
  preheader: string
  content: CampaignContent
  status: CampaignStatus
  scheduledAt: string | null
  startedAt: string | null
  finishedAt: string | null
  total: number
  sent: number
  failed: number
  skipped: number
  pending: number
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export type CampaignProgress = {
  campaign: AdminCampaign | null
  usage: { day: number; minute: number; dailyLimit: number; ratePerMinute: number }
  failures: Array<{ email: string; error: string | null; status?: string }>
}

type CampaignRow = typeof newsletterCampaigns.$inferSelect

/**
 * Daty w kolumnach `datetime` drizzle zapisuje jako UTC („2026-10-22 07:37:39.001”).
 * Wartości wstawiane ręcznie w `sql\`…\`` (bez mapowania kolumny) muszą mieć ten sam
 * zapis — inaczej mysql2 poda czas lokalny serwera (np. CEST) i porównania
 * rozjadą się o 1–2 h. NIE używaj tu NOW() z bazy (strefa sesji MySQL).
 */
const utc = (date: Date) => date.toISOString().replace('T', ' ').replace('Z', '')

const iso = (value: Date | null | undefined) => (value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null)

function parseContent(json: string | null | undefined): CampaignContent {
  try {
    return normalizeCampaignContent(JSON.parse(json || '{}'))
  } catch {
    return normalizeCampaignContent({})
  }
}

function toAdmin(row: CampaignRow, counts?: Partial<Record<'sent' | 'failed' | 'skipped' | 'pending', number>>): AdminCampaign {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    preheader: row.preheader,
    content: parseContent(row.content),
    status: row.status,
    scheduledAt: iso(row.scheduledAt),
    startedAt: iso(row.startedAt),
    finishedAt: iso(row.finishedAt),
    total: row.totalCount,
    sent: counts?.sent ?? row.sentCount,
    failed: counts?.failed ?? row.failedCount,
    skipped: counts?.skipped ?? Math.max(0, row.totalCount - row.sentCount - row.failedCount - (counts?.pending ?? 0)),
    pending: counts?.pending ?? Math.max(0, row.totalCount - row.sentCount - row.failedCount),
    lastError: row.lastError ?? null,
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(row.updatedAt) ?? new Date().toISOString(),
  }
}

const affected = (result: unknown) => {
  const header = Array.isArray(result) ? result[0] : result
  return (header as { affectedRows?: number })?.affectedRows ?? 0
}

const ID_RE = /^[0-9a-f-]{36}$/i
function assertId(id: string) {
  if (!ID_RE.test(String(id))) throw new Error('Nieprawidłowy identyfikator kampanii.')
  return id
}

// ─── odczyt ──────────────────────────────────────────────────────────────────

async function recipientCounts(campaignIds: string[]) {
  const map = new Map<string, Record<'sent' | 'failed' | 'skipped' | 'pending', number>>()
  if (!campaignIds.length) return map
  const rows = await db
    .select({
      campaignId: newsletterCampaignRecipients.campaignId,
      status: newsletterCampaignRecipients.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(newsletterCampaignRecipients)
    .where(inArray(newsletterCampaignRecipients.campaignId, campaignIds))
    .groupBy(newsletterCampaignRecipients.campaignId, newsletterCampaignRecipients.status)
  for (const row of rows) {
    const entry = map.get(row.campaignId) ?? { sent: 0, failed: 0, skipped: 0, pending: 0 }
    entry[row.status] = Number(row.count) || 0
    map.set(row.campaignId, entry)
  }
  return map
}

export async function listCampaigns(): Promise<AdminCampaign[]> {
  const rows = await db.select().from(newsletterCampaigns).orderBy(desc(newsletterCampaigns.createdAt)).limit(200)
  const counts = await recipientCounts(rows.filter((row) => row.status !== 'draft' && row.status !== 'scheduled').map((row) => row.id))
  return rows.map((row) => toAdmin(row, counts.get(row.id)))
}

export async function getCampaign(id: string): Promise<AdminCampaign | null> {
  const [row] = await db.select().from(newsletterCampaigns).where(eq(newsletterCampaigns.id, assertId(id))).limit(1)
  if (!row) return null
  const counts = await recipientCounts([row.id])
  return toAdmin(row, counts.get(row.id))
}

/** Ilu adresatów dostałoby kampanię teraz (aktywni + potwierdzony zapis). */
export async function audienceSize(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(newsletterSubscribers)
    .where(and(eq(newsletterSubscribers.isActive, true), isNotNull(newsletterSubscribers.confirmedAt)))
  return Number(row?.count) || 0
}

/** Ile maili wyszło w ostatniej dobie / minucie (wszystkie kampanie) — do limitów i panelu. */
export async function sendingUsage(now = new Date()) {
  const [row] = await db
    .select({
      day: sql<number>`SUM(CASE WHEN ${newsletterCampaignRecipients.sentAt} >= ${utc(new Date(now.getTime() - DAY_MS))} THEN 1 ELSE 0 END)`,
      minute: sql<number>`SUM(CASE WHEN ${newsletterCampaignRecipients.sentAt} >= ${utc(new Date(now.getTime() - 60_000))} THEN 1 ELSE 0 END)`,
    })
    .from(newsletterCampaignRecipients)
    .where(and(eq(newsletterCampaignRecipients.status, 'sent'), gte(newsletterCampaignRecipients.sentAt, new Date(now.getTime() - DAY_MS))))
  return { day: Number(row?.day) || 0, minute: Number(row?.minute) || 0, dailyLimit: DAILY_LIMIT(), ratePerMinute: RATE_PER_MINUTE() }
}

// ─── edycja ──────────────────────────────────────────────────────────────────

export type CampaignInput = { name?: unknown; subject?: unknown; preheader?: unknown; content?: unknown }

const clean = (value: unknown, max: number) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

/** Formularz → zapisywalna kampania (tekst sanityzowany jak opisy produktów). */
export function sanitizeCampaignInput(input: CampaignInput): CampaignDraft {
  const content = normalizeCampaignContent(input.content)
  const { value } = sanitizeRichText(content.body, { images: true })
  return {
    name: clean(input.name, CAMPAIGN_LIMITS.name) || 'Kampania bez nazwy',
    subject: clean(input.subject, CAMPAIGN_LIMITS.subject),
    preheader: clean(input.preheader, CAMPAIGN_LIMITS.preheader),
    content: { ...content, body: value },
  }
}

const EDITABLE: CampaignStatus[] = ['draft', 'scheduled']

export async function createCampaign(createdBy: string | null): Promise<string> {
  const id = randomUUID()
  const date = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' }).format(new Date())
  await db.insert(newsletterCampaigns).values({
    id,
    name: `Kampania ${date}`,
    subject: '',
    preheader: '',
    content: JSON.stringify(EMPTY_CAMPAIGN_CONTENT),
    status: 'draft',
    createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  return id
}

export async function updateCampaign(id: string, input: CampaignInput): Promise<AdminCampaign> {
  const draft = sanitizeCampaignInput(input)
  const result = await db
    .update(newsletterCampaigns)
    .set({
      name: draft.name,
      subject: draft.subject,
      preheader: draft.preheader,
      content: JSON.stringify(draft.content),
      updatedAt: new Date(),
    })
    .where(and(eq(newsletterCampaigns.id, assertId(id)), inArray(newsletterCampaigns.status, EDITABLE)))
  if (!affected(result)) throw new Error('Tej kampanii nie można już edytować (wysyłka ruszyła albo kampania została usunięta).')
  const saved = await getCampaign(id)
  if (!saved) throw new Error('Kampania nie istnieje.')
  return saved
}

export async function duplicateCampaign(id: string, createdBy: string | null): Promise<string> {
  const source = await getCampaign(id)
  if (!source) throw new Error('Kampania nie istnieje.')
  const copy = randomUUID()
  await db.insert(newsletterCampaigns).values({
    id: copy,
    name: `${source.name} (kopia)`.slice(0, CAMPAIGN_LIMITS.name),
    subject: source.subject,
    preheader: source.preheader,
    content: JSON.stringify(source.content),
    status: 'draft',
    createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  return copy
}

export async function deleteCampaign(id: string) {
  const campaign = await getCampaign(id)
  if (!campaign) return
  if (campaign.status === 'sending') throw new Error('Najpierw wstrzymaj wysyłkę.')
  await db.transaction(async (tx) => {
    await tx.delete(newsletterCampaignRecipients).where(eq(newsletterCampaignRecipients.campaignId, id))
    await tx.delete(newsletterCampaigns).where(eq(newsletterCampaigns.id, id))
  })
}

// ─── składanie maila ─────────────────────────────────────────────────────────

const PRODUCTS_QUERY = `*[_type == "product" && _id in $ids && defined(slug.current)]{
  _id, title, "slug": slug.current, price, promotion, images,
  variants[]{ _key, price, stock }
}`

type SanityCampaignProduct = {
  _id: string
  title?: string
  slug: string
  price?: number
  promotion?: unknown
  images?: unknown[]
  variants?: Array<{ _key: string; price?: number; stock?: number }>
}

/** Zdjęcie z Sanity w formacie, który pokaże każdy klient poczty (JPG, nie WebP). */
export function emailImageUrl(assetId: string, width: number): string | null {
  try {
    return urlFor({ asset: { _ref: assetId } } as Parameters<typeof urlFor>[0]).width(width).fit('max').format('jpg').quality(82).url()
  } catch {
    return null
  }
}

/** Produkty kampanii (opublikowane, w kolejności z panelu) — cena jak na kafelku sklepu. */
export async function loadCampaignProducts(ids: string[]): Promise<CampaignProduct[]> {
  if (!ids.length) return []
  const docs = await sanityClient
    .withConfig({ perspective: 'published', useCdn: false })
    .fetch<SanityCampaignProduct[]>(PRODUCTS_QUERY, { ids })
  const byId = new Map((docs ?? []).map((doc) => [doc._id, doc]))
  return ids
    .map((id) => byId.get(id))
    .filter((doc): doc is SanityCampaignProduct => Boolean(doc))
    .map((doc) => {
      const image = primaryImageForVariant(doc.images as never, doc.variants?.[0]?._key) as { asset?: { _ref?: string } } | null
      const ref = image?.asset?._ref
      let imageUrl: string | null = null
      try {
        imageUrl = ref ? urlFor(image as never).width(544).height(544).fit('crop').bg('ffffff').format('jpg').quality(82).url() : null
      } catch {
        imageUrl = null
      }
      return {
        id: doc._id,
        title: doc.title || 'Produkt',
        slug: doc.slug,
        price: listingPrice(doc as never),
        imageUrl,
      }
    })
}

const unsubscribePageUrl = (token: string) => absoluteUrl(`/newsletter/wypisz?token=${encodeURIComponent(token)}`)
const oneClickUrl = (token: string) => absoluteUrl(`/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`)

function render(draft: CampaignDraft, products: CampaignProduct[], unsubscribeUrl: string) {
  return renderCampaignEmail({
    ...draft,
    products,
    shopUrl: SITE_URL,
    logoUrl: absoluteUrl(EMAIL_LOGO_PATH),
    unsubscribeUrl,
    imageUrl: emailImageUrl,
  })
}

/** Podgląd w panelu — dokładnie ten HTML, który dostanie odbiorca. */
export async function previewCampaign(input: CampaignInput) {
  const draft = sanitizeCampaignInput(input)
  const products = await loadCampaignProducts(draft.content.productIds)
  const missing = draft.content.productIds.length - products.length
  return { ...render(draft, products, absoluteUrl('/newsletter/wypisz')), missingProducts: missing, problems: campaignProblems(draft) }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Mail testowy na wskazany adres (temat z dopiskiem [TEST]). */
export async function sendTestCampaign(input: CampaignInput, to: string) {
  const address = String(to ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(address) || address.length > 256) throw new Error('Podaj poprawny adres e-mail.')
  if (!isMailConfigured()) throw new Error('Wysyłka maili nie jest skonfigurowana (SMTP_HOST w .env).')
  const draft = sanitizeCampaignInput(input)
  if (!draft.subject) throw new Error('Uzupełnij temat maila.')
  const products = await loadCampaignProducts(draft.content.productIds)
  const mail = render(draft, products, absoluteUrl('/newsletter/wypisz'))
  await sendMail({ to: address, subject: `[TEST] ${mail.subject}`, html: mail.html, text: mail.text })
}

// ─── start, pauza, anulowanie ────────────────────────────────────────────────

/** Uzupełnia brakujące tokeny wypisania (starsze zapisy) — każdy mail musi mieć link wypisania. */
async function ensureUnsubTokens() {
  const missing = await db
    .select({ id: newsletterSubscribers.id })
    .from(newsletterSubscribers)
    .where(and(eq(newsletterSubscribers.isActive, true), isNotNull(newsletterSubscribers.confirmedAt), sql`${newsletterSubscribers.unsubToken} IS NULL`))
  for (const { id } of missing) {
    await db
      .update(newsletterSubscribers)
      .set({ unsubToken: randomBytes(24).toString('hex') })
      .where(and(eq(newsletterSubscribers.id, id), sql`${newsletterSubscribers.unsubToken} IS NULL`))
  }
}

/** Migawka odbiorców i przejście w `sending` (w jednej transakcji, tylko z draft/scheduled). */
async function beginSending(id: string): Promise<number> {
  await ensureUnsubTokens()
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(newsletterCampaigns).where(eq(newsletterCampaigns.id, id)).for('update').limit(1)
    if (!row || !EDITABLE.includes(row.status)) throw new Error('Kampania jest już wysyłana albo została wysłana.')
    await tx.execute(sql`
      INSERT IGNORE INTO newsletter_campaign_recipients (campaign_id, subscriber_id, email, status, attempts)
      SELECT ${id}, s.id, s.email, 'pending', 0
      FROM newsletter_subscribers s
      WHERE s.is_active = 1 AND s.confirmed_at IS NOT NULL`)
    const [count] = await tx
      .select({ count: sql<number>`COUNT(*)` })
      .from(newsletterCampaignRecipients)
      .where(eq(newsletterCampaignRecipients.campaignId, id))
    const total = Number(count?.count) || 0
    if (!total) throw new Error('Brak aktywnych subskrybentów z potwierdzonym zapisem — nie ma do kogo wysłać.')
    const now = new Date()
    await tx
      .update(newsletterCampaigns)
      .set({ status: 'sending', startedAt: now, scheduledAt: null, totalCount: total, sentCount: 0, failedCount: 0, lastError: null, updatedAt: now })
      .where(eq(newsletterCampaigns.id, id))
    return total
  })
}

export type StartResult = { status: 'sending'; total: number } | { status: 'scheduled'; scheduledAt: string }

/**
 * Wyślij teraz albo zaplanuj. Zapisuje bieżącą treść z formularza (wysyłamy
 * dokładnie to, co admin widzi w podglądzie) i sprawdza blokery.
 */
export async function startCampaign(id: string, input: CampaignInput, scheduledAt?: string | null): Promise<StartResult> {
  assertId(id)
  if (!isMailConfigured()) throw new Error('Wysyłka maili nie jest skonfigurowana (SMTP_HOST w .env) — kampania nie może wystartować.')
  const saved = await updateCampaign(id, input)
  const problems = campaignProblems(saved)
  if (problems.length) throw new Error(problems.join(' '))
  const missing = saved.content.productIds.length - (await loadCampaignProducts(saved.content.productIds)).length
  if (missing > 0) throw new Error(`${missing === 1 ? 'Jeden produkt' : `${missing} produkty`} z kampanii nie jest opublikowany albo został usunięty — usuń go z listy.`)
  if (scheduledAt) {
    const date = new Date(scheduledAt)
    if (Number.isNaN(date.getTime())) throw new Error('Nieprawidłowa data wysyłki.')
    if (date.getTime() > Date.now() + 60_000) {
      if (date.getTime() > Date.now() + 90 * DAY_MS) throw new Error('Wysyłkę można zaplanować najwyżej 90 dni naprzód.')
      if (!(await audienceSize())) throw new Error('Brak aktywnych subskrybentów z potwierdzonym zapisem.')
      await db
        .update(newsletterCampaigns)
        .set({ status: 'scheduled', scheduledAt: date, updatedAt: new Date() })
        .where(and(eq(newsletterCampaigns.id, id), inArray(newsletterCampaigns.status, EDITABLE)))
      return { status: 'scheduled', scheduledAt: date.toISOString() }
    }
  }
  const total = await beginSending(id)
  return { status: 'sending', total }
}

/** Zaplanowana → z powrotem szkic (można edytować i wysłać ponownie). */
export async function unscheduleCampaign(id: string) {
  await db
    .update(newsletterCampaigns)
    .set({ status: 'draft', scheduledAt: null, updatedAt: new Date() })
    .where(and(eq(newsletterCampaigns.id, assertId(id)), eq(newsletterCampaigns.status, 'scheduled')))
}

export async function pauseCampaign(id: string) {
  await db
    .update(newsletterCampaigns)
    .set({ status: 'paused', updatedAt: new Date() })
    .where(and(eq(newsletterCampaigns.id, assertId(id)), eq(newsletterCampaigns.status, 'sending')))
}

export async function resumeCampaign(id: string) {
  if (!isMailConfigured()) throw new Error('Wysyłka maili nie jest skonfigurowana (SMTP_HOST w .env).')
  await db
    .update(newsletterCampaigns)
    .set({ status: 'sending', lastError: null, updatedAt: new Date() })
    .where(and(eq(newsletterCampaigns.id, assertId(id)), eq(newsletterCampaigns.status, 'paused')))
}

/** Zatrzymuje na stałe — niewysłani odbiorcy dostają `skipped`. */
export async function cancelCampaign(id: string) {
  assertId(id)
  await db.transaction(async (tx) => {
    const result = await tx
      .update(newsletterCampaigns)
      .set({ status: 'cancelled', finishedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(newsletterCampaigns.id, id), inArray(newsletterCampaigns.status, ['sending', 'paused'])))
    if (!affected(result)) return
    await tx
      .update(newsletterCampaignRecipients)
      .set({ status: 'skipped', error: 'kampania zatrzymana' })
      .where(and(eq(newsletterCampaignRecipients.campaignId, id), eq(newsletterCampaignRecipients.status, 'pending')))
  })
  await refreshCounters(id)
}

/** Wypisanie w trakcie kampanii — niewysłane maile do tej osoby nie wyjdą. */
export async function skipPendingForSubscriber(subscriberId: string) {
  await db
    .update(newsletterCampaignRecipients)
    .set({ status: 'skipped', error: 'wypisał(a) się' })
    .where(and(eq(newsletterCampaignRecipients.subscriberId, subscriberId), eq(newsletterCampaignRecipients.status, 'pending')))
}

// ─── wysyłka partiami ────────────────────────────────────────────────────────

async function refreshCounters(id: string) {
  const counts = (await recipientCounts([id])).get(id) ?? { sent: 0, failed: 0, skipped: 0, pending: 0 }
  await db
    .update(newsletterCampaigns)
    .set({ sentCount: counts.sent, failedCount: counts.failed })
    .where(eq(newsletterCampaigns.id, id))
  return counts
}

type SmtpError = { responseCode?: number; code?: string; message?: string }

/** Błąd całego połączenia/konta (stop partii) vs. błąd jednego adresu. */
function classifyError(error: unknown): { scope: 'recipient' | 'transient' | 'account'; message: string } {
  const e = (error ?? {}) as SmtpError
  const message = String(e.message ?? error).slice(0, 280)
  if (e.code === 'EAUTH') return { scope: 'account', message: `Serwer poczty odrzucił logowanie (SMTP_USER/SMTP_PASS): ${message}` }
  const code = Number(e.responseCode)
  // 550/551/553 — nieistniejący adres, 552 — pełna skrzynka (trwale dla tej wysyłki)
  if ([550, 551, 552, 553, 501].includes(code)) return { scope: 'recipient', message }
  // 421/450/451/452/454 — limit lub chwilowy problem serwera: przerywamy partię, spróbujemy później
  if (code >= 400 && code < 500) return { scope: 'transient', message }
  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ECONNRESET'].includes(String(e.code))) return { scope: 'transient', message }
  return { scope: 'recipient', message }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type SendFn = typeof sendMail

export type ProcessReport = {
  sent: number
  failed: number
  skipped: number
  started: string[]
  finished: string[]
  stoppedBy: 'done' | 'budget' | 'daily-limit' | 'locked' | 'error' | 'no-smtp'
}

async function acquireLock(): Promise<string | null> {
  const token = randomUUID()
  try {
    const ok = await redis.set(LOCK_KEY, token, { NX: true, PX: LOCK_TTL_MS })
    return ok ? token : null
  } catch (err) {
    console.error('[campaigns] Redis niedostępny — wysyłka bez blokady', err)
    return token
  }
}

async function releaseLock(token: string) {
  try {
    if ((await redis.get(LOCK_KEY)) === token) await redis.del(LOCK_KEY)
  } catch {
    /* blokada i tak wygaśnie */
  }
}

/**
 * Wysyła, co się da w `budgetMs`: najpierw uruchamia zaplanowane kampanie,
 * których czas minął, potem partie kampanii `sending` (najstarsza pierwsza)
 * w granicach limitu minutowego i dobowego. Bezpieczna do wołania z wielu
 * miejsc naraz (blokada + warunkowe „zajmowanie” odbiorcy).
 */
export async function processCampaigns(options: { budgetMs?: number; send?: SendFn; now?: () => Date } = {}): Promise<ProcessReport> {
  const budgetMs = options.budgetMs ?? 20_000
  const send = options.send ?? sendMail
  const now = options.now ?? (() => new Date())
  const deadline = Date.now() + budgetMs
  const report: ProcessReport = { sent: 0, failed: 0, skipped: 0, started: [], finished: [], stoppedBy: 'done' }

  if (!options.send && !isMailConfigured()) return { ...report, stoppedBy: 'no-smtp' }
  const lock = await acquireLock()
  if (!lock) return { ...report, stoppedBy: 'locked' }

  try {
    // 1) Zaplanowane, których czas minął.
    const due = await db
      .select({ id: newsletterCampaigns.id })
      .from(newsletterCampaigns)
      .where(and(eq(newsletterCampaigns.status, 'scheduled'), lte(newsletterCampaigns.scheduledAt, now())))
    for (const { id } of due) {
      try {
        await beginSending(id)
        report.started.push(id)
      } catch (err) {
        await db
          .update(newsletterCampaigns)
          .set({ status: 'draft', lastError: `Nie wystartowała o czasie: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500) })
          .where(and(eq(newsletterCampaigns.id, id), eq(newsletterCampaigns.status, 'scheduled')))
      }
    }

    // 2) Wysyłka.
    const productCache = new Map<string, CampaignProduct[]>()
    while (Date.now() < deadline) {
      const [campaign] = await db
        .select()
        .from(newsletterCampaigns)
        .where(eq(newsletterCampaigns.status, 'sending'))
        .orderBy(asc(newsletterCampaigns.startedAt))
        .limit(1)
      if (!campaign) break

      const usage = await sendingUsage(now())
      if (usage.day >= usage.dailyLimit) {
        await db
          .update(newsletterCampaigns)
          .set({ lastError: `Osiągnięto dzienny limit wysyłki (${usage.dailyLimit} maili / 24 h). Reszta wyjdzie automatycznie, gdy limit się zwolni.` })
          .where(eq(newsletterCampaigns.id, campaign.id))
        report.stoppedBy = 'daily-limit'
        break
      }
      const room = Math.min(usage.ratePerMinute - usage.minute, usage.dailyLimit - usage.day)
      if (room <= 0) {
        // Limit minutowy — czekamy, jeśli budżet na to pozwala.
        if (Date.now() + 5_000 >= deadline) {
          report.stoppedBy = 'budget'
          break
        }
        await sleep(Math.min(5_000, deadline - Date.now()))
        continue
      }

      const batch = await db
        .select({
          subscriberId: newsletterCampaignRecipients.subscriberId,
          email: newsletterCampaignRecipients.email,
          attempts: newsletterCampaignRecipients.attempts,
          active: newsletterSubscribers.isActive,
          token: newsletterSubscribers.unsubToken,
        })
        .from(newsletterCampaignRecipients)
        .leftJoin(newsletterSubscribers, eq(newsletterSubscribers.id, newsletterCampaignRecipients.subscriberId))
        .where(and(eq(newsletterCampaignRecipients.campaignId, campaign.id), eq(newsletterCampaignRecipients.status, 'pending')))
        .orderBy(asc(newsletterCampaignRecipients.attempts), asc(newsletterCampaignRecipients.email))
        .limit(room)

      if (!batch.length) {
        const counts = await refreshCounters(campaign.id)
        if (!counts.pending) {
          await db
            .update(newsletterCampaigns)
            .set({ status: 'sent', finishedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(newsletterCampaigns.id, campaign.id), eq(newsletterCampaigns.status, 'sending')))
          report.finished.push(campaign.id)
        }
        continue
      }

      const draft: CampaignDraft = {
        name: campaign.name,
        subject: campaign.subject,
        preheader: campaign.preheader,
        content: parseContent(campaign.content),
      }
      if (!productCache.has(campaign.id)) productCache.set(campaign.id, await loadCampaignProducts(draft.content.productIds))
      const products = productCache.get(campaign.id)!

      let stopCampaign: string | null = null
      for (const recipient of batch) {
        if (Date.now() >= deadline) break
        // Sprawdzamy na bieżąco, czy kampania nie została wstrzymana z panelu.
        const where = and(
          eq(newsletterCampaignRecipients.campaignId, campaign.id),
          eq(newsletterCampaignRecipients.subscriberId, recipient.subscriberId),
          eq(newsletterCampaignRecipients.status, 'pending'),
          eq(newsletterCampaignRecipients.attempts, recipient.attempts),
        )
        if (!recipient.active || !recipient.token) {
          if (affected(await db.update(newsletterCampaignRecipients).set({ status: 'skipped', error: 'wypisał(a) się' }).where(where))) report.skipped += 1
          continue
        }
        // „Zajęcie” odbiorcy — drugi proces nie wyśle tego samego maila.
        const claimed = affected(
          await db
            .update(newsletterCampaignRecipients)
            .set({ attempts: recipient.attempts + 1 })
            .where(and(where, sql`EXISTS (SELECT 1 FROM newsletter_campaigns c WHERE c.id = ${campaign.id} AND c.status = 'sending')`)),
        )
        if (!claimed) continue

        const mail = render(draft, products, unsubscribePageUrl(recipient.token))
        const headers: Record<string, string> = {
          'List-Unsubscribe': `<${oneClickUrl(recipient.token)}>${SELLER.email ? `, <mailto:${SELLER.email}?subject=${encodeURIComponent('Wypisz mnie z newslettera')}>` : ''}`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'X-HAU-Campaign': campaign.id,
        }
        const key = and(eq(newsletterCampaignRecipients.campaignId, campaign.id), eq(newsletterCampaignRecipients.subscriberId, recipient.subscriberId))
        try {
          const ok = await send({ to: recipient.email, subject: mail.subject, html: mail.html, text: mail.text, headers })
          if (!ok) {
            stopCampaign = 'Wysyłka maili nie jest skonfigurowana (SMTP).'
            await db.update(newsletterCampaignRecipients).set({ attempts: recipient.attempts }).where(key)
            break
          }
          await db.update(newsletterCampaignRecipients).set({ status: 'sent', sentAt: new Date(), error: null }).where(key)
          report.sent += 1
        } catch (err) {
          const { scope, message } = classifyError(err)
          if (scope === 'account') {
            // Konto SMTP nie działa — każdy kolejny mail też by przepadł.
            await db.update(newsletterCampaignRecipients).set({ attempts: recipient.attempts, error: message.slice(0, 300) }).where(key)
            stopCampaign = message
            break
          }
          const final = scope === 'recipient' || recipient.attempts + 1 >= MAX_ATTEMPTS
          await db
            .update(newsletterCampaignRecipients)
            .set({ status: final ? 'failed' : 'pending', error: message.slice(0, 300) })
            .where(key)
          if (final) report.failed += 1
          if (scope === 'transient') {
            await db.update(newsletterCampaigns).set({ lastError: `Serwer poczty chwilowo odmawia (${message}). Spróbujemy ponownie później.`.slice(0, 500) }).where(eq(newsletterCampaigns.id, campaign.id))
            report.stoppedBy = 'error'
            break
          }
        }
      }

      if (stopCampaign) {
        await db
          .update(newsletterCampaigns)
          .set({ status: 'paused', lastError: `Wstrzymano: ${stopCampaign}`.slice(0, 500), updatedAt: new Date() })
          .where(eq(newsletterCampaigns.id, campaign.id))
        report.stoppedBy = 'error'
      }
      await refreshCounters(campaign.id)
      if (report.stoppedBy === 'error') break
    }
    if (report.stoppedBy === 'done' && Date.now() >= deadline) report.stoppedBy = 'budget'
    return report
  } finally {
    await releaseLock(lock)
  }
}

/** Kampanie oczekujące na wysyłkę (do odpytywania z panelu). */
export async function hasActiveCampaigns(): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(newsletterCampaigns)
    .where(or(eq(newsletterCampaigns.status, 'sending'), and(eq(newsletterCampaigns.status, 'scheduled'), lte(newsletterCampaigns.scheduledAt, new Date()))))
  return (Number(row?.count) || 0) > 0
}

/** Ostatni odbiorcy z błędem (lista w panelu). */
export async function failedRecipients(id: string, limit = 50) {
  return db
    .select({ email: newsletterCampaignRecipients.email, error: newsletterCampaignRecipients.error, status: newsletterCampaignRecipients.status })
    .from(newsletterCampaignRecipients)
    .where(and(eq(newsletterCampaignRecipients.campaignId, assertId(id)), eq(newsletterCampaignRecipients.status, 'failed')))
    .limit(limit)
}
