import 'server-only'
import { and, asc, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { productPriceHistory, type PriceChangeSource } from '@/db/schema'
import { sanityClient } from '@/sanity/sanityClient.server'
import {
  OMNIBUS_WINDOW_MS,
  computeOmnibus,
  fromCents,
  isValidPriceKey,
  isValidProductId,
  priceKeysOf,
  type PriceInterval,
  type ProductOmnibus,
} from '@/lib/omnibus'
import type { ProductPromotion } from '@/lib/promotion'

/*
 * Rejestr cen produktów (MySQL `product_price_history`) — źródło danych
 * dla „najniższej ceny z 30 dni”.
 *
 * Ceny żyją w Sanity, więc rejestr UZGADNIA stan: pobiera świeży,
 * opublikowany dokument (bez CDN) i porównuje ceny z otwartymi
 * przedziałami w bazie. Różnica = zamknięcie starego przedziału i otwarcie
 * nowego. Uzgodnienie jest idempotentne, więc może je wywołać każdy:
 *
 *   - panel admina i import CSV — zaraz po zapisie (źródło `admin`/`import`),
 *   - webhook Sanity — po publikacji w Studio (`webhook`),
 *   - okresowe zadanie `/api/cron/price-history` — siatka bezpieczeństwa (`cron`),
 *   - wyświetlenie produktu — najwyżej raz na RECHECK_SECONDS (`observed`).
 *
 * Unikalny indeks `price_history_one_open` nie pozwala na dwa otwarte
 * przedziały, a transakcja z `FOR UPDATE` serializuje równoległe zmiany
 * (konflikt = ponowienie całego uzgodnienia produktu).
 */

const RECHECK_SECONDS = 120
const RETRY_AFTER_FAILURE_SECONDS = 30
const HISTORY_CACHE_SECONDS = 600
const RECONCILE_TIMEOUT_MS = 2500
const SANITY_CHUNK = 100
const MAX_RETRIES = 5

const historyKey = (productId: string) => `prices:history:v1:${productId}`
const recheckKey = (productId: string) => `prices:checked:v1:${productId}`

/** Świeży odczyt opublikowanych cen — nigdy z CDN (inaczej rejestr cofnąłby zmianę). */
const fresh = sanityClient.withConfig({ useCdn: false, perspective: 'published' })

export type PriceDoc = {
  _id: string
  _updatedAt?: string | null
  price?: number | null
  variants?: Array<{ _key?: string | null; price?: number | null } | null> | null
  promotion?: ProductPromotion | null
}

export type SyncResult = { checked: number; changed: number; failed: string[] }

// ─── odczyt cen z Sanity ─────────────────────────────────────────────────────

async function fetchPriceDocs(ids: string[]): Promise<Map<string, PriceDoc>> {
  const docs = new Map<string, PriceDoc>()
  for (let i = 0; i < ids.length; i += SANITY_CHUNK) {
    const chunk = ids.slice(i, i + SANITY_CHUNK)
    const rows = await fresh.fetch<PriceDoc[]>(
      `*[_type == "product" && _id in $ids]{ _id, _updatedAt, price, variants[]{ _key, price }, promotion }`,
      { ids: chunk },
    )
    for (const row of rows) docs.set(row._id, row)
  }
  return docs
}

// ─── zapis zmian ──────────────────────────────────────────────────────────────

const RETRYABLE_CODES = new Set(['ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'])

/** Drizzle opakowuje błąd sterownika (`cause`) — sprawdzamy cały łańcuch. */
function isRetryable(error: unknown) {
  let current: unknown = error
  for (let depth = 0; current && depth < 5; depth++) {
    const code = (current as { code?: unknown }).code
    if (typeof code === 'string' && RETRYABLE_CODES.has(code)) return true
    current = (current as { cause?: unknown }).cause
  }
  return false
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Moment zmiany ceny. Przy zapisie z panelu/importu/webhooka zmiana dzieje się
 * „teraz”. Przy wykryciu z opóźnieniem (cron, wyświetlenie) lepszym
 * przybliżeniem jest `_updatedAt` dokumentu — o ile nie jest starszy od
 * początku bieżącego przedziału ani nie leży w przyszłości.
 */
function changeMoment(doc: PriceDoc | undefined, source: PriceChangeSource, now: Date): Date {
  if (source !== 'cron' && source !== 'observed') return now
  const updated = doc?._updatedAt ? new Date(doc._updatedAt) : null
  if (!updated || Number.isNaN(updated.getTime()) || updated > now) return now
  // Promocja czasowa zmienia cenę BEZ edycji dokumentu: zapisana wcześniej,
  // zaczyna (kończy) się o `startsAt` (`endsAt`). Wtedy momentem zmiany jest
  // ta granica, a nie `_updatedAt` — inaczej rejestr „cofnąłby” cenę
  // promocyjną do chwili zapisu w panelu i zafałszował historię.
  let moment = updated
  for (const boundary of [doc?.promotion?.startsAt, doc?.promotion?.endsAt]) {
    const time = boundary ? new Date(boundary) : null
    if (time && !Number.isNaN(time.getTime()) && time <= now && time > moment) moment = time
  }
  return moment
}

async function syncOne(productId: string, doc: PriceDoc | undefined, source: PriceChangeSource, now: Date): Promise<boolean> {
  const desired = doc ? priceKeysOf(doc, now) : new Map<string, number>()
  const detectedAt = changeMoment(doc, source, now)

  return db.transaction(async (tx) => {
    const open = await tx
      .select({
        id: productPriceHistory.id,
        variantKey: productPriceHistory.variantKey,
        priceCents: productPriceHistory.priceCents,
        validFrom: productPriceHistory.validFrom,
      })
      .from(productPriceHistory)
      .where(and(eq(productPriceHistory.productId, productId), isNull(productPriceHistory.validTo)))
      .for('update')

    const openByKey = new Map(open.map((row) => [row.variantKey, row]))
    let changed = false

    // Ceny, których już nie ma w sklepie (wycofany produkt, usunięty wariant).
    for (const row of open) {
      if (desired.has(row.variantKey)) continue
      await tx
        .update(productPriceHistory)
        .set({ validTo: now > row.validFrom ? now : row.validFrom })
        .where(eq(productPriceHistory.id, row.id))
      changed = true
    }

    const keysWithoutOpen = [...desired.keys()].filter((key) => !openByKey.has(key))
    const known = new Set<string>()
    if (keysWithoutOpen.length) {
      const rows = await tx
        .selectDistinct({ variantKey: productPriceHistory.variantKey })
        .from(productPriceHistory)
        .where(and(eq(productPriceHistory.productId, productId), inArray(productPriceHistory.variantKey, keysWithoutOpen)))
      rows.forEach((row) => known.add(row.variantKey))
    }

    for (const [variantKey, priceCents] of desired) {
      const current = openByKey.get(variantKey)
      if (current && current.priceCents === priceCents) continue

      let validFrom = now
      if (current) {
        // Nowa cena nie może zacząć się przed początkiem poprzedniej.
        validFrom = detectedAt > current.validFrom ? detectedAt : new Date(current.validFrom.getTime() + 1)
        if (validFrom > now) validFrom = now
        await tx.update(productPriceHistory).set({ validTo: validFrom }).where(eq(productPriceHistory.id, current.id))
      }
      await tx.insert(productPriceHistory).values({
        productId,
        variantKey,
        priceCents,
        validFrom,
        validTo: null,
        source: current || known.has(variantKey) ? source : 'init',
      })
      changed = true
    }
    return changed
    // READ COMMITTED: `FOR UPDATE` blokuje tylko istniejące wiersze (bez blokad
    // luk, które przy równoległym pierwszym zapisie kończyły się zakleszczeniem).
    // Wyścig o pierwszy wiersz rozstrzyga unikalny indeks — przegrany ponawia.
  }, { isolationLevel: 'read committed' })
}

async function invalidateHistory(productIds: string[]) {
  if (!productIds.length) return
  try {
    await redis.del(productIds.map(historyKey))
  } catch (err) {
    console.error('[priceHistory] cache invalidation failed', err)
  }
}

/**
 * Uzgadnia rejestr z bieżącymi (opublikowanymi) cenami w Sanity.
 * `docs` — świeże dokumenty, jeśli wywołujący już je ma; brakujące
 * zostaną pobrane. Brak dokumentu = produkt nie jest w sklepie.
 */
export async function syncProductPrices(
  productIds: string[],
  source: PriceChangeSource,
  options: { docs?: Map<string, PriceDoc> } = {},
): Promise<SyncResult> {
  const ids = [...new Set(productIds.map((id) => id.replace(/^drafts\./, '')))].filter(isValidProductId)
  const result: SyncResult = { checked: ids.length, changed: 0, failed: [] }
  if (!ids.length) return result

  const docs = new Map(options.docs ?? [])
  const missing = ids.filter((id) => !docs.has(id))
  if (missing.length) {
    const fetched = await fetchPriceDocs(missing)
    fetched.forEach((doc, id) => docs.set(id, doc))
  }

  const now = new Date()
  const changedIds: string[] = []
  for (const id of ids) {
    for (let attempt = 1; ; attempt++) {
      try {
        if (await syncOne(id, docs.get(id), source, now)) {
          result.changed++
          changedIds.push(id)
        }
        break
      } catch (err) {
        if (attempt < MAX_RETRIES && isRetryable(err)) {
          await pause(10 * attempt + Math.random() * 20)
          continue
        }
        console.error('[priceHistory] sync failed', id, err)
        result.failed.push(id)
        break
      }
    }
  }

  await invalidateHistory(changedIds)
  // Zapisy z panelu/importu/webhooka są świeże — odkładamy kolejne sprawdzenie przy wyświetleniu.
  await markChecked(ids.filter((id) => !result.failed.includes(id)))
  return result
}

/**
 * Wersja „nie przeszkadzaj”: dla panelu admina i importu. Zapis ceny w Sanity
 * już się udał — awaria rejestru nie może zamienić go w błąd. Rozbieżność
 * i tak wyrówna cron albo pierwsze wyświetlenie produktu.
 */
export async function recordPriceChanges(productIds: string[], source: PriceChangeSource) {
  try {
    const result = await syncProductPrices(productIds, source)
    if (result.failed.length) console.error('[priceHistory] not recorded', result.failed)
    return result
  } catch (err) {
    console.error('[priceHistory] record failed', err)
    return null
  }
}

/** Wszystkie produkty: opublikowane + te, które mają otwartą cenę w rejestrze (mogły zniknąć ze sklepu). */
export async function syncAllProductPrices(source: PriceChangeSource = 'cron'): Promise<SyncResult> {
  const published = await fresh.fetch<string[]>(`*[_type == "product"]._id`)
  const openRows = await db
    .selectDistinct({ productId: productPriceHistory.productId })
    .from(productPriceHistory)
    .where(isNull(productPriceHistory.validTo))
  const ids = [...new Set([...published, ...openRows.map((row) => row.productId)])]

  const total: SyncResult = { checked: 0, changed: 0, failed: [] }
  for (let i = 0; i < ids.length; i += SANITY_CHUNK) {
    const chunk = ids.slice(i, i + SANITY_CHUNK)
    const part = await syncProductPrices(chunk, source)
    total.checked += part.checked
    total.changed += part.changed
    total.failed.push(...part.failed)
  }
  return total
}

// ─── uzgadnianie przy wyświetleniu (z limitem) ───────────────────────────────

async function markChecked(ids: string[]) {
  if (!ids.length) return
  try {
    const multi = redis.multi()
    for (const id of ids) multi.set(recheckKey(id), '1', { EX: RECHECK_SECONDS })
    await multi.exec()
  } catch {
    /* Redis niedostępny — trudno, najwyżej sprawdzimy ponownie. */
  }
}

async function takeRecheckSlots(ids: string[]): Promise<string[]> {
  try {
    const multi = redis.multi()
    for (const id of ids) multi.set(recheckKey(id), '1', { EX: RECHECK_SECONDS, NX: true })
    const replies = await multi.exec()
    return ids.filter((_, i) => String(replies[i]) === 'OK')
  } catch {
    // Bez Redisa nie sprawdzamy przy każdym wyświetleniu — zostaje cron i zapisy z panelu.
    return []
  }
}

async function reconcileOnView(ids: string[]) {
  const due = await takeRecheckSlots(ids)
  if (!due.length) return
  const work = syncProductPrices(due, 'observed').catch(async (err) => {
    console.error('[priceHistory] observe failed', err)
    // Krótsza blokada: ponowimy wkrótce, ale nie przy każdym wyświetleniu
    // (awaria Sanity nie może spowalniać każdej strony).
    try {
      const multi = redis.multi()
      for (const id of due) multi.set(recheckKey(id), '1', { EX: RETRY_AFTER_FAILURE_SECONDS })
      await multi.exec()
    } catch {
      /* ignore */
    }
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, RECONCILE_TIMEOUT_MS)
  })
  await Promise.race([work, timeout])
  if (timer) clearTimeout(timer)
}

// ─── odczyt historii ──────────────────────────────────────────────────────────

type SerializedInterval = { k: string; c: number; f: number; t: number | null }
type History = Map<string, PriceInterval[]>

function deserialize(rows: SerializedInterval[]): History {
  const history: History = new Map()
  for (const row of rows) {
    const list = history.get(row.k) ?? []
    list.push({ priceCents: row.c, from: new Date(row.f), to: row.t === null ? null : new Date(row.t) })
    history.set(row.k, list)
  }
  return history
}

/**
 * Przedziały potrzebne do wyliczeń: ostatnie 30 dni oraz 30 dni przed
 * początkiem każdej bieżącej ceny (obniżka może trwać dłużej niż miesiąc).
 */
async function loadHistoryFromDb(productIds: string[], now: Date): Promise<Map<string, SerializedInterval[]>> {
  const result = new Map<string, SerializedInterval[]>()
  if (!productIds.length) return result

  const open = await db
    .select({ productId: productPriceHistory.productId, validFrom: productPriceHistory.validFrom })
    .from(productPriceHistory)
    .where(and(inArray(productPriceHistory.productId, productIds), isNull(productPriceHistory.validTo)))

  let since = now.getTime() - OMNIBUS_WINDOW_MS
  for (const row of open) since = Math.min(since, row.validFrom.getTime() - OMNIBUS_WINDOW_MS)

  const rows = await db
    .select({
      productId: productPriceHistory.productId,
      variantKey: productPriceHistory.variantKey,
      priceCents: productPriceHistory.priceCents,
      validFrom: productPriceHistory.validFrom,
      validTo: productPriceHistory.validTo,
    })
    .from(productPriceHistory)
    .where(
      and(
        inArray(productPriceHistory.productId, productIds),
        or(isNull(productPriceHistory.validTo), gt(productPriceHistory.validTo, new Date(since))),
      ),
    )
    .orderBy(asc(productPriceHistory.validFrom))

  for (const id of productIds) result.set(id, [])
  for (const row of rows) {
    result.get(row.productId)?.push({
      k: row.variantKey,
      c: row.priceCents,
      f: row.validFrom.getTime(),
      t: row.validTo ? row.validTo.getTime() : null,
    })
  }
  return result
}

async function loadHistories(productIds: string[], now: Date): Promise<Map<string, History>> {
  const histories = new Map<string, History>()
  let cached: Array<string | null> = []
  try {
    cached = productIds.length ? await redis.mGet(productIds.map(historyKey)) : []
  } catch {
    cached = []
  }

  const missing: string[] = []
  productIds.forEach((id, i) => {
    const hit = cached[i]
    if (hit) {
      try {
        histories.set(id, deserialize(JSON.parse(hit) as SerializedInterval[]))
        return
      } catch {
        /* uszkodzony wpis — czytamy z bazy */
      }
    }
    missing.push(id)
  })

  if (missing.length) {
    const fromDb = await loadHistoryFromDb(missing, now)
    try {
      const multi = redis.multi()
      fromDb.forEach((rows, id) => multi.set(historyKey(id), JSON.stringify(rows), { EX: HISTORY_CACHE_SECONDS }))
      await multi.exec()
    } catch {
      /* cache jest opcjonalny */
    }
    fromDb.forEach((rows, id) => histories.set(id, deserialize(rows)))
  }
  return histories
}

/**
 * Informacja Omnibus dla produktów. Liczona dla ceny, która jest bieżąca
 * w rejestrze (klient porównuje ją z ceną, którą wyświetla).
 * `reconcile` — najpierw (z limitem) uzgodnij rejestr z Sanity.
 */
export async function getOmnibusForProducts(
  productIds: string[],
  options: { reconcile?: boolean } = {},
): Promise<Record<string, ProductOmnibus>> {
  const ids = [...new Set(productIds)].filter(isValidProductId)
  if (!ids.length) return {}
  if (options.reconcile) await reconcileOnView(ids)

  const now = new Date()
  const histories = await loadHistories(ids, now)
  const result: Record<string, ProductOmnibus> = {}
  for (const id of ids) {
    const history = histories.get(id)
    const perKey: ProductOmnibus = {}
    history?.forEach((intervals, key) => {
      if (!isValidPriceKey(key)) return
      const open = intervals.find((interval) => interval.to === null)
      if (!open) return
      perKey[key] = computeOmnibus(intervals, fromCents(open.priceCents), now)
    })
    result[id] = perKey
  }
  return result
}

// ─── panel admina ─────────────────────────────────────────────────────────────

export type PriceHistoryEntry = {
  variantKey: string
  price: number
  validFrom: string
  validTo: string | null
  source: PriceChangeSource
}

export type AdminPriceHistory = {
  entries: PriceHistoryEntry[]
  /** Bieżąca najniższa cena z 30 dni / obniżka — per klucz ceny. */
  omnibus: ProductOmnibus
}

/** Ostatnie zmiany cen produktu (do podglądu w panelu). */
export async function listPriceHistory(productId: string, limit = 50): Promise<PriceHistoryEntry[]> {
  if (!isValidProductId(productId)) return []
  const rows = await db
    .select()
    .from(productPriceHistory)
    .where(eq(productPriceHistory.productId, productId))
    .orderBy(desc(productPriceHistory.validFrom), desc(productPriceHistory.id))
    .limit(Math.min(Math.max(limit, 1), 200))
  return rows.map((row) => ({
    variantKey: row.variantKey,
    price: fromCents(row.priceCents),
    validFrom: row.validFrom.toISOString(),
    validTo: row.validTo ? row.validTo.toISOString() : null,
    source: row.source,
  }))
}

