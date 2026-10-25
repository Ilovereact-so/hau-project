import 'server-only'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { orderItems, orders, stockMovements, type OrderStockState } from '@/db/schema'
import { sanityClient } from '@/sanity/sanityClient.server'
import { assertDocId, draftId, invalidateCatalogCache } from '@/lib/admin/catalog'
import { PAID_ORDER_STATUSES } from '@/lib/orderStatus'
import {
  applyStockChange,
  cloneStockFields,
  groupOrderLines,
  type StockChangeKind,
  type StockDocFields,
  type StockLine,
  type StockPlan,
} from '@/lib/inventory'

/*
 * Automatyczne zdejmowanie i oddawanie stanu magazynu.
 *
 *  - zdejmujemy, gdy zamówienie jest OPŁACONE (ITN Autopay, Przelewy24,
 *    dev-bypass) albo od razu przy złożeniu zamówienia za pobraniem,
 *  - oddajemy przy anulowaniu zamówienia w panelu oraz — przy zwrocie —
 *    dopiero gdy admin kliknie „Towar wrócił na magazyn” (zwrócone pieniądze
 *    nie znaczą, że paczka już dojechała),
 *  - nieopłacone zamówienia NIC nie rezerwują (anulowanie po terminie nic
 *    nie oddaje, bo nic nie zdjęto).
 *
 * Bezpieczeństwo przed podwójnym zdjęciem:
 *  1. blokada Redis na zamówienie (`inventory:order:<id>`),
 *  2. `orders.stock_state` (none → pending → deducted → restored),
 *  3. unikalny wiersz `stock_movements` na (zamówienie, produkt, wariant, rodzaj)
 *     — zapisywany PRZED zmianą w Sanity; gdy zapis w Sanity się nie uda,
 *     wiersz jest usuwany. Gdyby proces padł między jednym a drugim, stan
 *     zostanie najwyżej NIEzdjęty (bezpieczniej niż zdjęty dwa razy).
 * Zmiana w Sanity idzie transakcją z `ifRevisionId` na każdej wersji
 * dokumentu (opublikowanej i szkicu), więc dwa równoległe zamówienia tego
 * samego produktu nie nadpiszą sobie stanu — przegrany ponawia od świeżych
 * danych.
 */

const raw = sanityClient.withConfig({ perspective: 'raw', useCdn: false })

const LOCK_TTL_MS = 60_000
const MAX_ATTEMPTS = 5
const RECONCILE_STATUSES = [...PAID_ORDER_STATUSES]

export type DeductReason = 'paid' | 'cod' | 'reconcile'
export type RestoreReason = 'cancelled' | 'returned'

export type InventoryResult =
  | { ok: true; state: OrderStockState; changed: boolean; note: string | null }
  | { ok: false; error: string }

type VersionDoc = StockDocFields & { _id: string; _rev: string }

type OrderLineMeta = StockLine & { label: string }

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))

async function withOrderLock<T>(orderId: string, fn: () => Promise<T>): Promise<T | null> {
  const key = `inventory:order:${orderId}`
  const token = randomUUID()
  const acquired = await redis.set(key, token, { NX: true, PX: LOCK_TTL_MS })
  if (!acquired) return null
  try {
    return await fn()
  } finally {
    try {
      if ((await redis.get(key)) === token) await redis.del(key)
    } catch {
      /* blokada i tak wygaśnie */
    }
  }
}

async function readOrder(orderId: string) {
  const [order] = await db
    .select({ id: orders.id, status: orders.status, stockState: orders.stockState, stockNote: orders.stockNote })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)
  return order ?? null
}

async function orderLines(orderId: string): Promise<OrderLineMeta[]> {
  const items = await db
    .select({ productId: orderItems.productId, variantId: orderItems.variantId, qty: orderItems.qty, name: orderItems.name, variantLabel: orderItems.variantLabel })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
  const labels = new Map<string, string>()
  for (const item of items) {
    const key = `${item.productId}::${item.variantId ?? ''}`
    if (!labels.has(key)) labels.set(key, item.variantLabel ? `${item.name} (${item.variantLabel})` : item.name)
  }
  return groupOrderLines(items).map((line) => ({ ...line, label: labels.get(`${line.productId}::${line.variantKey}`) ?? line.productId }))
}

async function existingMovements(orderId: string) {
  return db.select().from(stockMovements).where(eq(stockMovements.orderId, orderId)).orderBy(asc(stockMovements.createdAt))
}

const isConflict = (err: unknown) => {
  const status = (err as { statusCode?: number })?.statusCode
  return status === 409 || /revision|conflict/i.test(errorMessage(err))
}

/**
 * Zmienia stan jednego produktu dla podanych pozycji (wszystkie warianty tego
 * produktu w jednym zamówieniu = jedna transakcja Sanity). Zwraca wyliczenia
 * dla wersji, którą widzi sklep (opublikowanej; bez niej — szkicu).
 */
async function changeProductStock(
  orderId: string,
  productId: string,
  lines: Array<{ variantKey: string; qty: number }>,
  kind: StockChangeKind,
  reason: string,
): Promise<Array<{ variantKey: string; qty: number; plan: StockPlan }>> {
  let safeId: string
  try {
    safeId = assertDocId(productId)
  } catch {
    safeId = ''
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const docs = safeId
      ? await raw.fetch<VersionDoc[]>(`*[_id in [$id, $draft]]{ _id, _rev, stock, variants[]{ _key, stock } }`, {
          id: safeId,
          draft: draftId(safeId),
        })
      : []
    const published = docs.find((doc) => doc._id === safeId)
    const draft = docs.find((doc) => doc._id === draftId(safeId))
    const primary = published ?? draft ?? null

    // Wyliczenia na kopiach roboczych — kolejne pozycje liczą się od nowej wartości.
    const primaryCopy = primary ? cloneStockFields(primary) : { stock: null, variants: [] }
    const results = lines.map((line) => ({ ...line, plan: applyStockChange(primaryCopy, line.variantKey || null, kind, line.qty) }))
    const versions = [published, draft].filter(Boolean) as VersionDoc[]
    const sets = versions.map((doc) => {
      const copy = cloneStockFields(doc)
      const set: Record<string, number> = {}
      for (const line of results) {
        // Szkic może mieć inny stan niż wersja opublikowana — zmieniamy go o tyle
        // samo, ile faktycznie zdjęto / oddano w sklepie (zawsze ≥ 0).
        const plan = applyStockChange(copy, line.variantKey || null, kind, line.plan.applied)
        if (plan.path && plan.applied > 0) set[plan.path] = plan.after as number
      }
      return { doc, set }
    }).filter((entry) => Object.keys(entry.set).length > 0)

    // 1) Najpierw ruchy w bazie (unikalny klucz = nigdy dwa razy to samo).
    const rows = results.map((line) => ({
      id: randomUUID(),
      orderId,
      productId,
      variantKey: line.variantKey,
      kind,
      requestedQty: line.qty,
      appliedQty: line.plan.applied,
      target: line.plan.target,
      stockBefore: line.plan.before,
      stockAfter: line.plan.after,
      reason,
    }))
    await db.insert(stockMovements).values(rows)

    if (!sets.length) return results

    // 2) Potem Sanity — z kontrolą wersji każdego dokumentu.
    try {
      const tx = raw.transaction()
      for (const { doc, set } of sets) tx.patch(doc._id, (patch) => patch.ifRevisionId(doc._rev).set(set))
      await tx.commit({ visibility: 'sync' })
      return results
    } catch (err) {
      await db.delete(stockMovements).where(inArray(stockMovements.id, rows.map((row) => row.id)))
      if (!isConflict(err) || attempt === MAX_ATTEMPTS) throw err
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt + Math.floor(Math.random() * 100)))
    }
  }
  throw new Error('Nie udało się zapisać stanu (zbyt wiele równoczesnych zmian).')
}

function groupByProduct<T extends { productId: string }>(lines: T[]) {
  const map = new Map<string, T[]>()
  for (const line of lines) {
    const list = map.get(line.productId)
    if (list) list.push(line)
    else map.set(line.productId, [line])
  }
  return map
}

async function refreshShop() {
  await invalidateCatalogCache()
  try {
    revalidatePath('/', 'layout')
  } catch {
    /* poza żądaniem (np. skrypt) — cache odświeży się sam */
  }
}

function shortageNote(items: Array<{ label: string; shortage: number }>) {
  if (!items.length) return null
  const text = items.map((item) => `${item.label} — ${item.shortage} szt.`).join('; ')
  return `Zabrakło towaru przy zdejmowaniu stanu: ${text}`.slice(0, 512)
}

/**
 * Zdejmuje stan dla zamówienia. Idempotentne — kolejne wywołania (ponowiony
 * ITN, cron, otwarcie zamówienia w panelu) niczego już nie zmieniają.
 */
export async function deductStockForOrder(orderId: string, reason: DeductReason): Promise<InventoryResult> {
  try {
    const outcome = await withOrderLock(orderId, async (): Promise<InventoryResult> => {
      const order = await readOrder(orderId)
      if (!order) return { ok: false, error: 'Zamówienie nie istnieje.' }
      if (order.stockState !== 'none' && order.stockState !== 'pending') {
        return { ok: true, state: order.stockState, changed: false, note: order.stockNote ?? null }
      }
      if (order.stockState === 'none') {
        await db.update(orders).set({ stockState: 'pending' }).where(and(eq(orders.id, orderId), eq(orders.stockState, 'none')))
      }

      const done = new Set(
        (await existingMovements(orderId)).filter((m) => m.kind === 'deduct').map((m) => `${m.productId}::${m.variantKey}`),
      )
      const lines = (await orderLines(orderId)).filter((line) => !done.has(`${line.productId}::${line.variantKey}`))

      let changed = false
      const shortages: Array<{ label: string; shortage: number }> = []
      const failures: string[] = []
      for (const [productId, productLines] of groupByProduct(lines)) {
        try {
          const results = await changeProductStock(orderId, productId, productLines, 'deduct', reason)
          for (const result of results) {
            if (result.plan.applied > 0) changed = true
            const label = productLines.find((line) => line.variantKey === result.variantKey)?.label ?? productId
            if (result.plan.shortage > 0) shortages.push({ label, shortage: result.plan.shortage })
          }
        } catch (err) {
          failures.push(productId)
          console.error(`[inventory] Zdjęcie stanu nie powiodło się (zamówienie ${orderId}, produkt ${productId}):`, errorMessage(err))
        }
      }

      if (changed) await refreshShop()

      // Notatka zbiera braki ze WSZYSTKICH prób (ponowienie nie gubi wcześniejszej).
      const previous = order.stockNote ?? ''
      const fresh = shortageNote(shortages)
      const note = [previous, fresh].filter(Boolean).join(' | ').slice(0, 512) || null

      if (failures.length) {
        await db.update(orders).set({ stockNote: note }).where(eq(orders.id, orderId))
        return { ok: false, error: `Nie udało się zdjąć stanu ${failures.length} produktu(ów) — spróbujemy ponownie.` }
      }
      await db.update(orders).set({ stockState: 'deducted', stockNote: note }).where(eq(orders.id, orderId))
      if (fresh) console.warn(`[inventory] Zamówienie ${orderId}: ${fresh}`)
      return { ok: true, state: 'deducted', changed, note }
    })
    return outcome ?? { ok: false, error: 'Stan tego zamówienia jest właśnie zmieniany — spróbuj za chwilę.' }
  } catch (err) {
    console.error(`[inventory] Zdjęcie stanu dla zamówienia ${orderId} nie powiodło się:`, errorMessage(err))
    return { ok: false, error: 'Nie udało się zdjąć stanu magazynu.' }
  }
}

/**
 * Oddaje na magazyn to, co zamówienie faktycznie zdjęło (nie więcej — przy
 * braku towaru zdjęto mniej, niż zamówiono). Idempotentne.
 */
export async function restoreStockForOrder(orderId: string, reason: RestoreReason): Promise<InventoryResult> {
  try {
    const outcome = await withOrderLock(orderId, async (): Promise<InventoryResult> => {
      const order = await readOrder(orderId)
      if (!order) return { ok: false, error: 'Zamówienie nie istnieje.' }
      if (order.stockState === 'restored' || order.stockState === 'legacy') {
        return { ok: true, state: order.stockState, changed: false, note: order.stockNote ?? null }
      }
      if (order.stockState === 'none') {
        // Nic nie zdjęto, więc nie ma czego oddawać. Stan zostaje `none`:
        // cron i tak nie rusza anulowanych zamówień, a gdyby po anulowaniu
        // wpłynęła spóźniona płatność (ITN przywraca „opłacone”), stan
        // zdejmie się normalnie.
        return { ok: true, state: 'none', changed: false, note: order.stockNote ?? null }
      }

      const movements = await existingMovements(orderId)
      const restored = new Set(movements.filter((m) => m.kind === 'restore').map((m) => `${m.productId}::${m.variantKey}`))
      const pending = movements
        .filter((m) => m.kind === 'deduct' && !restored.has(`${m.productId}::${m.variantKey}`))
        .map((m) => ({ productId: m.productId, variantKey: m.variantKey, qty: m.appliedQty }))

      let changed = false
      const failures: string[] = []
      for (const [productId, productLines] of groupByProduct(pending)) {
        try {
          const results = await changeProductStock(orderId, productId, productLines, 'restore', reason)
          if (results.some((result) => result.plan.applied > 0)) changed = true
        } catch (err) {
          failures.push(productId)
          console.error(`[inventory] Oddanie stanu nie powiodło się (zamówienie ${orderId}, produkt ${productId}):`, errorMessage(err))
        }
      }

      if (changed) await refreshShop()
      if (failures.length) return { ok: false, error: `Nie udało się oddać stanu ${failures.length} produktu(ów). Spróbuj ponownie.` }
      await db.update(orders).set({ stockState: 'restored' }).where(eq(orders.id, orderId))
      return { ok: true, state: 'restored', changed, note: order.stockNote ?? null }
    })
    return outcome ?? { ok: false, error: 'Stan tego zamówienia jest właśnie zmieniany — spróbuj za chwilę.' }
  } catch (err) {
    console.error(`[inventory] Oddanie stanu dla zamówienia ${orderId} nie powiodło się:`, errorMessage(err))
    return { ok: false, error: 'Nie udało się oddać stanu magazynu.' }
  }
}

/** Wywołanie „przy okazji” (webhook, kasa) — nigdy nie rzuca. */
export async function deductStockQuietly(orderId: string, reason: DeductReason) {
  try {
    const result = await deductStockForOrder(orderId, reason)
    if (!result.ok) console.warn(`[inventory] Zamówienie ${orderId}: ${result.error}`)
  } catch (err) {
    console.error(`[inventory] Zamówienie ${orderId}:`, errorMessage(err))
  }
}

/**
 * Dogrywka dla zamówień opłaconych, którym stan nie został zdjęty (awaria
 * Sanity w chwili ITN, przerwany proces). Woła ją zadanie cykliczne.
 */
export async function reconcileOrderStock(limit = 50) {
  const candidates = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(inArray(orders.status, RECONCILE_STATUSES), inArray(orders.stockState, ['none', 'pending'])))
    .orderBy(asc(orders.createdAt))
    .limit(limit)

  let deducted = 0
  let failed = 0
  for (const { id } of candidates) {
    const result = await deductStockForOrder(id, 'reconcile')
    if (result.ok) deducted++
    else failed++
  }
  return { checked: candidates.length, deducted, failed }
}

export type OrderStockInfo = {
  state: OrderStockState
  note: string | null
  movements: Array<{
    productId: string
    variantKey: string
    kind: StockChangeKind
    requestedQty: number
    appliedQty: number
    target: string
    stockBefore: number | null
    stockAfter: number | null
    reason: string
    createdAt: Date
  }>
}

/** Dane do karty „Magazyn” w szczegółach zamówienia. */
export async function getOrderStockInfo(orderId: string): Promise<OrderStockInfo | null> {
  const order = await readOrder(orderId)
  if (!order) return null
  const movements = await existingMovements(orderId)
  return {
    state: order.stockState,
    note: order.stockNote ?? null,
    movements: movements.map((m) => ({
      productId: m.productId,
      variantKey: m.variantKey,
      kind: m.kind,
      requestedQty: m.requestedQty,
      appliedQty: m.appliedQty,
      target: m.target,
      stockBefore: m.stockBefore,
      stockAfter: m.stockAfter,
      reason: m.reason,
      createdAt: m.createdAt,
    })),
  }
}

export const RECONCILABLE_STATUSES: readonly string[] = RECONCILE_STATUSES
