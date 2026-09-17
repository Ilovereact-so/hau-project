import 'server-only'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { redis } from '@/lib/redis'
import { db } from '@/lib/db'
import { cartItems, wishlistItems } from '@/db/schema'
import { sanitizeCartLines, sanitizeWishlistIds, type CartLine } from '@/lib/cartMerge'

// Wspólna warstwa zapisu/odczytu koszyka i wishlisty.
// Redis = szybki cache (TTL 30 dni), MySQL = trwałe źródło prawdy.
// Odczyt: Redis → przy braku klucza MySQL (i ponowne rozgrzanie Redisa).

export const GUEST_COOKIE = 'guest_id'
const TTL_SECONDS = 60 * 60 * 24 * 30

const cartKey     = (ownerId: string) => `cart:${ownerId}`
const wishlistKey = (userId: string)  => `wishlist:${userId}`

// ── gość ─────────────────────────────────────────────────────────────────────

const GUEST_ID_RE = /^guest_[0-9a-f-]{36}$/

export async function readGuestId(): Promise<string | null> {
  const value = (await cookies()).get(GUEST_COOKIE)?.value
  // Nie ufamy dowolnej wartości ciasteczka — trafia do kluczy Redisa i SQL.
  return value && GUEST_ID_RE.test(value) ? value : null
}

/** Tylko w akcjach serwerowych i route handlerach (ustawia ciasteczko). */
export async function getOrCreateGuestId(): Promise<string> {
  const existing = await readGuestId()
  if (existing) return existing

  const guestId = `guest_${crypto.randomUUID()}`
  ;(await cookies()).set(GUEST_COOKIE, guestId, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   TTL_SECONDS,
    sameSite: 'lax',
    path:     '/',
  })
  return guestId
}

export async function clearGuestCookie() {
  (await cookies()).delete(GUEST_COOKIE)
}

// ── koszyk ───────────────────────────────────────────────────────────────────

export async function readCart(ownerId: string): Promise<CartLine[]> {
  try {
    const raw = await redis.get(cartKey(ownerId))
    if (raw !== null) return sanitizeCartLines(JSON.parse(raw))
  } catch (err) {
    console.error('[cart] redis read failed, falling back to MySQL', err)
  }

  const rows = await db
    .select({ productId: cartItems.productId, variantId: cartItems.variantId, qty: cartItems.qty })
    .from(cartItems)
    .where(eq(cartItems.ownerId, ownerId))
  const lines = sanitizeCartLines(rows)

  if (lines.length) {
    await redis.setEx(cartKey(ownerId), TTL_SECONDS, JSON.stringify(lines)).catch(console.error)
  }
  return lines
}

/** Zastępuje cały koszyk właściciela (Redis + MySQL w transakcji). */
export async function writeCart(ownerId: string, input: CartLine[]): Promise<void> {
  const lines = sanitizeCartLines(input)

  await db.transaction(async tx => {
    await tx.delete(cartItems).where(eq(cartItems.ownerId, ownerId))
    if (lines.length) {
      await tx.insert(cartItems).values(lines.map(l => ({
        id:        crypto.randomUUID(),
        ownerId,
        productId: l.productId,
        variantId: l.variantId,
        qty:       l.qty,
      })))
    }
  })

  if (lines.length) await redis.setEx(cartKey(ownerId), TTL_SECONDS, JSON.stringify(lines))
  else              await redis.del(cartKey(ownerId))
}

export async function deleteCart(ownerId: string): Promise<void> {
  await Promise.all([
    redis.del(cartKey(ownerId)),
    db.delete(cartItems).where(eq(cartItems.ownerId, ownerId)),
  ])
}

// ── wishlista (tylko konta — gość trzyma ją w localStorage) ─────────────────

export async function readWishlist(userId: string): Promise<string[]> {
  try {
    const exists = await redis.exists(wishlistKey(userId))
    if (exists) return sanitizeWishlistIds(await redis.sMembers(wishlistKey(userId)))
  } catch (err) {
    console.error('[wishlist] redis read failed, falling back to MySQL', err)
  }

  const rows = await db
    .select({ productId: wishlistItems.productId })
    .from(wishlistItems)
    .where(eq(wishlistItems.userId, userId))
    .orderBy(wishlistItems.addedAt)
  const ids = sanitizeWishlistIds(rows.map(r => r.productId))

  if (ids.length) {
    await warmWishlist(userId, ids).catch(console.error)
  }
  return ids
}

async function warmWishlist(userId: string, ids: string[]) {
  const key = wishlistKey(userId)
  await redis.multi().del(key).sAdd(key, ids).expire(key, TTL_SECONDS).exec()
}

export async function writeWishlist(userId: string, input: string[]): Promise<void> {
  const ids = sanitizeWishlistIds(input)

  await db.transaction(async tx => {
    await tx.delete(wishlistItems).where(eq(wishlistItems.userId, userId))
    if (ids.length) {
      await tx.insert(wishlistItems).values(ids.map(productId => ({ userId, productId })))
    }
  })

  if (ids.length) await warmWishlist(userId, ids)
  else            await redis.del(wishlistKey(userId))
}
