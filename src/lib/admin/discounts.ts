import 'server-only'
import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { discountCodes, discountRedemptions, orders, DISCOUNT_TYPES, type DiscountType } from '@/db/schema'
import { DISCOUNT_CODE_RE, discountStatus, normalizeDiscountCode } from '@/lib/discounts'

/*
 * Kody rabatowe w panelu (/admin/discounts). Kwoty w groszach, daty w UTC.
 * Kod, którego ktoś użył, można tylko wyłączyć — usunięcie zgubiłoby ślad
 * w rozliczeniach (zamówienie i tak trzyma kod i kwotę rabatu).
 */

export interface AdminDiscountCode {
  id: string
  code: string
  description: string | null
  type: DiscountType
  value: number
  minSubtotalCents: number
  maxDiscountCents: number | null
  startsAt: string | null
  endsAt: string | null
  usageLimit: number | null
  usageLimitPerUser: number | null
  timesUsed: number
  isActive: boolean
  status: ReturnType<typeof discountStatus>
  /** suma rabatów z zamówień (bez anulowanych) */
  totalDiscountCents: number
  /** przychód z zamówień z tym kodem (opłacone i dalej) */
  revenueCents: number
  createdAt: string
}

export interface AdminRedemption {
  orderId: string
  code: string
  discountCents: number
  totalCents: number
  status: string
  email: string
  createdAt: string
}

export interface AdminDiscountsData {
  codes: AdminDiscountCode[]
  recent: AdminRedemption[]
  totals: { redemptions: number; discountCents: number; revenueCents: number }
}

const PAID_STATUSES = ['paid', 'processing', 'shipped', 'delivered'] as const

export async function getAdminDiscounts(): Promise<AdminDiscountsData> {
  const paidList = sql.join(PAID_STATUSES.map((s) => sql`${s}`), sql`, `)
  const [rows, stats, recent] = await Promise.all([
    db.select().from(discountCodes).orderBy(desc(discountCodes.createdAt)),
    db
      .select({
        discountCodeId: discountRedemptions.discountCodeId,
        discountCents: sql<number>`coalesce(sum(${discountRedemptions.discountCents}), 0)`,
        revenueCents: sql<number>`coalesce(sum(case when ${orders.status} in (${paidList}) then ${orders.totalCents} else 0 end), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(discountRedemptions)
      .leftJoin(orders, eq(orders.id, discountRedemptions.orderId))
      .groupBy(discountRedemptions.discountCodeId),
    db
      .select({
        orderId: discountRedemptions.orderId,
        code: discountRedemptions.code,
        discountCents: discountRedemptions.discountCents,
        email: discountRedemptions.customerEmail,
        createdAt: discountRedemptions.createdAt,
        totalCents: orders.totalCents,
        status: orders.status,
      })
      .from(discountRedemptions)
      .leftJoin(orders, eq(orders.id, discountRedemptions.orderId))
      .orderBy(desc(discountRedemptions.createdAt))
      .limit(12),
  ])

  const byCode = new Map(stats.map((s) => [s.discountCodeId, s]))
  const now = new Date()
  const codes: AdminDiscountCode[] = rows.map((row) => {
    const stat = byCode.get(row.id)
    return {
      id: row.id,
      code: row.code,
      description: row.description,
      type: row.type,
      value: row.value,
      minSubtotalCents: row.minSubtotalCents,
      maxDiscountCents: row.maxDiscountCents,
      startsAt: row.startsAt?.toISOString() ?? null,
      endsAt: row.endsAt?.toISOString() ?? null,
      usageLimit: row.usageLimit,
      usageLimitPerUser: row.usageLimitPerUser,
      timesUsed: row.timesUsed,
      isActive: row.isActive,
      status: discountStatus(row, now),
      totalDiscountCents: Number(stat?.discountCents ?? 0),
      revenueCents: Number(stat?.revenueCents ?? 0),
      createdAt: row.createdAt.toISOString(),
    }
  })

  return {
    codes,
    recent: recent.map((r) => ({
      orderId: r.orderId,
      code: r.code,
      discountCents: r.discountCents,
      totalCents: Number(r.totalCents ?? 0),
      status: r.status ?? 'cancelled',
      email: r.email,
      createdAt: r.createdAt.toISOString(),
    })),
    totals: {
      redemptions: stats.reduce((sum, s) => sum + Number(s.count), 0),
      discountCents: codes.reduce((sum, c) => sum + c.totalDiscountCents, 0),
      revenueCents: codes.reduce((sum, c) => sum + c.revenueCents, 0),
    },
  }
}

// ─── zapis ─────────────────────────────────────────────────────────────────────

export interface DiscountCodeInput {
  id?: string
  code: string
  description?: string | null
  type: DiscountType
  /** procent (1–100) albo grosze */
  value: number
  minSubtotalCents?: number | null
  maxDiscountCents?: number | null
  startsAt?: string | null
  endsAt?: string | null
  usageLimit?: number | null
  usageLimitPerUser?: number | null
  isActive?: boolean
}

function optionalPositiveInt(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) throw new Error(`${label} musi być dodatnią liczbą całkowitą.`)
  return n
}

function optionalDate(value: unknown, label: string): Date | null {
  if (!value) return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new Error(`Nieprawidłowa data: ${label}.`)
  return date
}

function validate(input: DiscountCodeInput) {
  const code = normalizeDiscountCode(input.code)
  if (!DISCOUNT_CODE_RE.test(code)) {
    throw new Error('Kod: 3–32 znaki, litery A–Z, cyfry, „-” lub „_”, zaczyna się literą lub cyfrą.')
  }
  if (!(DISCOUNT_TYPES as readonly string[]).includes(input.type)) throw new Error('Nieznany rodzaj rabatu.')

  const value = Math.round(Number(input.value) || 0)
  if (input.type === 'percent' && (value < 1 || value > 100)) throw new Error('Rabat procentowy: od 1 do 100%.')
  if (input.type === 'fixed' && value < 1) throw new Error('Podaj kwotę rabatu.')

  const minSubtotalCents = Math.max(0, Math.round(Number(input.minSubtotalCents) || 0))
  const maxDiscountCents =
    input.type === 'percent' && input.maxDiscountCents ? Math.max(1, Math.round(Number(input.maxDiscountCents))) : null
  const startsAt = optionalDate(input.startsAt, 'początek')
  const endsAt = optionalDate(input.endsAt, 'koniec')
  if (startsAt && endsAt && endsAt <= startsAt) throw new Error('Koniec ważności musi być po początku.')

  const description = String(input.description ?? '').trim().slice(0, 255) || null

  return {
    code,
    description,
    type: input.type,
    value: input.type === 'free_shipping' ? 0 : value,
    minSubtotalCents,
    maxDiscountCents,
    startsAt,
    endsAt,
    usageLimit: optionalPositiveInt(input.usageLimit, 'Limit użyć'),
    usageLimitPerUser: optionalPositiveInt(input.usageLimitPerUser, 'Limit na klienta'),
    isActive: input.isActive ?? true,
  }
}

function isDuplicate(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } }
  return e?.code === 'ER_DUP_ENTRY' || e?.cause?.code === 'ER_DUP_ENTRY'
}

export async function saveDiscountCode(input: DiscountCodeInput): Promise<{ id: string }> {
  const data = validate(input)
  try {
    if (input.id) {
      const result = await db
        .update(discountCodes)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(discountCodes.id, input.id))
      if (!result[0]?.affectedRows) throw new Error('Nie znaleziono kodu.')
      return { id: input.id }
    }
    const id = crypto.randomUUID()
    await db.insert(discountCodes).values({ id, ...data })
    return { id }
  } catch (err) {
    if (isDuplicate(err)) throw new Error(`Kod ${data.code} już istnieje.`)
    throw err
  }
}

export async function setDiscountCodeActive(id: string, isActive: boolean): Promise<void> {
  await db.update(discountCodes).set({ isActive, updatedAt: new Date() }).where(eq(discountCodes.id, id))
}

export async function deleteDiscountCode(id: string): Promise<void> {
  const [used] = await db
    .select({ n: sql<number>`count(*)` })
    .from(discountRedemptions)
    .where(eq(discountRedemptions.discountCodeId, id))
  if (Number(used?.n ?? 0) > 0) {
    throw new Error('Tego kodu użyto w zamówieniach — możesz go wyłączyć, ale nie usunąć (historia rozliczeń).')
  }
  await db.delete(discountCodes).where(eq(discountCodes.id, id))
}
