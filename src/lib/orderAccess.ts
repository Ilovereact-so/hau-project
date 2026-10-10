import 'server-only'
import { createHmac } from 'crypto'
import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orders } from '@/db/schema'
import { readGuestId } from '@/lib/cartServer'
import { safeEqual } from '@/lib/server/secrets'

/*
 * Dostęp do zamówienia złożonego BEZ logowania.
 *
 * Zamówienie gościa ma `user_id = guest_…` (ciasteczko `guest_id`). Strona
 * zamówienia gościa (/zamowienie/[id]) wpuszcza:
 *  - tę samą przeglądarkę (ciasteczko `guest_id` = właściciel), albo
 *  - posiadacza podpisanego linku `?t=<token>` — token = HMAC(id zamówienia),
 *    więc działa też na innym urządzeniu i po wyczyszczeniu ciasteczek, a nie
 *    da się go odgadnąć dla cudzego zamówienia.
 *
 * Sekret: ORDER_LINK_SECRET (zalecany), a bez niego CLERK_SECRET_KEY —
 * zmiana sekretu unieważnia wcześniej wysłane linki.
 */

function secret(): string | null {
  return process.env.ORDER_LINK_SECRET?.trim() || process.env.CLERK_SECRET_KEY?.trim() || null
}

export function orderAccessToken(orderId: string): string | null {
  const key = secret()
  if (!key) return null
  return createHmac('sha256', key).update(`order:${orderId}`).digest('base64url').slice(0, 32)
}

export function verifyOrderAccessToken(orderId: string, token: string | null | undefined): boolean {
  if (!token) return false
  const expected = orderAccessToken(orderId)
  return Boolean(expected && safeEqual(expected, token))
}

/** Pełny adres strony zamówienia gościa (z tokenem). */
export function guestOrderPath(orderId: string, params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params)
  const token = orderAccessToken(orderId)
  if (token) query.set('t', token)
  const suffix = query.toString()
  return `/zamowienie/${orderId}${suffix ? `?${suffix}` : ''}`
}

export type OrderAccess = 'owner-user' | 'owner-guest' | 'token' | null

/**
 * Czy bieżący odwiedzający może zobaczyć zamówienie. Zalogowany właściciel
 * ma swoje zamówienia w profilu; tu rozstrzygamy dostęp gościa.
 */
export async function resolveOrderAccess(orderId: string, token?: string | null): Promise<{ access: OrderAccess; ownerId: string | null }> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return { access: null, ownerId: null }
  const [order] = await db.select({ userId: orders.userId }).from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!order) return { access: null, ownerId: null }
  const { userId } = await auth()
  if (userId && order.userId === userId) return { access: 'owner-user', ownerId: order.userId }
  const guestId = await readGuestId()
  if (guestId && order.userId === guestId) return { access: 'owner-guest', ownerId: order.userId }
  if (verifyOrderAccessToken(orderId, token)) return { access: 'token', ownerId: order.userId }
  return { access: null, ownerId: order.userId }
}
