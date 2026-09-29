import 'server-only'
import { and, eq, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { discountCodes, discountRedemptions } from '@/db/schema'
import {
  DISCOUNT_CODE_RE,
  REJECTION_MESSAGES,
  applyDiscount,
  evaluateDiscount,
  normalizeDiscountCode,
  type DiscountEvaluation,
  type DiscountRule,
} from '@/lib/discounts'

/*
 * Kody rabatowe — warstwa serwerowa.
 *
 * - `lookupDiscount` — odczyt kodu do podglądu w koszyku (bez blokad).
 * - `redeemDiscount` — w TRANSAKCJI zamówienia: blokuje wiersz kodu
 *   (SELECT … FOR UPDATE), sprawdza limity jeszcze raz, zapisuje użycie
 *   i zwiększa licznik. Dwa równoczesne zamówienia nie przekroczą limitu.
 * - `releaseDiscountForOrder` — anulowanie zamówienia oddaje użycie.
 * - Limit nieudanych prób (Redis) utrudnia zgadywanie kodów.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export class DiscountError extends Error {}

function toRule(row: typeof discountCodes.$inferSelect): DiscountRule {
  return {
    code: row.code,
    description: row.description,
    type: row.type,
    value: row.value,
    minSubtotalCents: row.minSubtotalCents,
    maxDiscountCents: row.maxDiscountCents,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    usageLimit: row.usageLimit,
    usageLimitPerUser: row.usageLimitPerUser,
    timesUsed: row.timesUsed,
    isActive: row.isActive,
  }
}

// ─── limit prób ────────────────────────────────────────────────────────────────

const ATTEMPT_WINDOW_S = 15 * 60
const MAX_FAILED_ATTEMPTS = 12

function attemptsKey(subject: string) {
  return `discount:failed:v1:${subject}`
}

export async function assertNotRateLimited(subject: string): Promise<void> {
  try {
    const count = Number(await redis.get(attemptsKey(subject)))
    if (count >= MAX_FAILED_ATTEMPTS) {
      throw new DiscountError('Zbyt wiele nieudanych prób. Spróbuj ponownie za kilkanaście minut.')
    }
  } catch (err) {
    if (err instanceof DiscountError) throw err
    // Redis niedostępny — nie blokujemy klienta, tylko tracimy limit prób.
    console.warn('[discounts] limit prób niedostępny:', err)
  }
}

export async function recordFailedAttempt(subject: string): Promise<void> {
  try {
    const key = attemptsKey(subject)
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, ATTEMPT_WINDOW_S)
  } catch (err) {
    console.warn('[discounts] nie zapisano próby:', err)
  }
}

// ─── odczyt ────────────────────────────────────────────────────────────────────

async function customerUses(
  executor: typeof db | Tx,
  discountCodeId: string,
  customer: { key: string; email: string | null },
): Promise<number> {
  const conditions = [eq(discountRedemptions.customerKey, customer.key)]
  if (customer.email) conditions.push(eq(discountRedemptions.customerEmail, customer.email))
  const [row] = await executor
    .select({ n: sql<number>`count(*)` })
    .from(discountRedemptions)
    .where(and(eq(discountRedemptions.discountCodeId, discountCodeId), or(...conditions)))
  return Number(row?.n ?? 0)
}

export type DiscountLookup =
  | { ok: true; rule: DiscountRule; evaluation: DiscountEvaluation }
  | { ok: false; message: string; notFound?: boolean }

/** Kod do podglądu (koszyk / podsumowanie kasy). Nie blokuje i nie zapisuje. */
export async function lookupDiscount(
  rawCode: string,
  ctx: { subtotalCents: number; customer?: { key: string; email: string | null } | null },
): Promise<DiscountLookup> {
  const code = normalizeDiscountCode(rawCode)
  if (!DISCOUNT_CODE_RE.test(code)) return { ok: false, message: REJECTION_MESSAGES.invalid_format, notFound: true }

  const [row] = await db.select().from(discountCodes).where(eq(discountCodes.code, code)).limit(1)
  if (!row) return { ok: false, message: REJECTION_MESSAGES.not_found, notFound: true }

  const uses = ctx.customer ? await customerUses(db, row.id, ctx.customer) : null
  const rule = toRule(row)
  return { ok: true, rule, evaluation: evaluateDiscount(rule, { subtotalCents: ctx.subtotalCents, customerUses: uses }) }
}

// ─── zapis w transakcji zamówienia ─────────────────────────────────────────────

/**
 * Rezerwuje użycie kodu dla zamówienia. Wołać WEWNĄTRZ `db.transaction`
 * tworzącej zamówienie — przy błędzie całe zamówienie się wycofa.
 * Rzuca `DiscountError` z komunikatem dla klienta.
 */
export async function redeemDiscount(
  tx: Tx,
  input: {
    code: string
    orderId: string
    customer: { key: string; email: string }
    subtotalCents: number
    shippingCents: number
  },
): Promise<{ code: string; discountCents: number; totalCents: number }> {
  const code = normalizeDiscountCode(input.code)
  if (!DISCOUNT_CODE_RE.test(code)) throw new DiscountError(REJECTION_MESSAGES.invalid_format)

  const [row] = await tx
    .select()
    .from(discountCodes)
    .where(eq(discountCodes.code, code))
    .limit(1)
    .for('update')
  if (!row) throw new DiscountError(REJECTION_MESSAGES.not_found)

  const uses = await customerUses(tx, row.id, input.customer)
  const evaluation = evaluateDiscount(toRule(row), { subtotalCents: input.subtotalCents, customerUses: uses })
  if (!evaluation.ok) throw new DiscountError(evaluation.message)

  const { discountCents, totalCents } = applyDiscount(evaluation, input.subtotalCents, input.shippingCents)
  if (discountCents <= 0) {
    throw new DiscountError('Ten kod nie obniża wartości tego zamówienia.')
  }

  await tx.insert(discountRedemptions).values({
    id: crypto.randomUUID(),
    discountCodeId: row.id,
    orderId: input.orderId,
    customerKey: input.customer.key,
    customerEmail: input.customer.email,
    code: row.code,
    discountCents,
  })
  await tx
    .update(discountCodes)
    .set({ timesUsed: sql`${discountCodes.timesUsed} + 1`, updatedAt: new Date() })
    .where(eq(discountCodes.id, row.id))

  return { code: row.code, discountCents, totalCents }
}

/** Anulowanie zamówienia oddaje użycie kodu (limit łączny i na klienta). */
export async function releaseDiscountForOrder(executor: typeof db | Tx, orderId: string): Promise<void> {
  const [redemption] = await executor
    .select({ id: discountRedemptions.id, discountCodeId: discountRedemptions.discountCodeId })
    .from(discountRedemptions)
    .where(eq(discountRedemptions.orderId, orderId))
    .limit(1)
  if (!redemption) return
  await executor.delete(discountRedemptions).where(eq(discountRedemptions.id, redemption.id))
  await executor
    .update(discountCodes)
    .set({ timesUsed: sql`greatest(${discountCodes.timesUsed} - 1, 0)`, updatedAt: new Date() })
    .where(eq(discountCodes.id, redemption.discountCodeId))
}
