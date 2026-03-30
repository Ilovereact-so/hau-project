import 'server-only'

import { auth } from '@clerk/nextjs/server'
import { redis } from '@/lib/redis'
import { db } from '@/lib/db'
import { cartItems } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getOrCreateGuestId } from '@/lib/guest'

type CartItem = {
  productId: string
  variantId?: string
  qty: number
}

// ── pomocnicza — ustal kto to ──────────────────────
async function getOwnerId(): Promise<string> {
  const { userId } = await auth()
  return userId ?? (await getOrCreateGuestId())
}

// ── pobierz koszyk ─────────────────────────────────
export async function getCart(): Promise<CartItem[]> {
  const ownerId = await getOwnerId()
  const raw = await redis.get(`cart:${ownerId}`)
  return raw ? JSON.parse(raw) : []
}

// ── dodaj do koszyka ───────────────────────────────
export async function addToCart(productId: string, qty = 1, variantId?: string) {
  const ownerId = await getOwnerId()
  const key = `cart:${ownerId}`

  const raw = await redis.get(key)
  const cart: CartItem[] = raw ? JSON.parse(raw) : []

  const existing = cart.find(
    i => i.productId === productId && i.variantId === variantId
  )

  if (existing) {
    existing.qty += qty
  } else {
    cart.push({ productId, qty, variantId })
  }

  // Redis primary
  await redis.setEx(key, 60 * 60 * 24 * 30, JSON.stringify(cart))

  // MySQL backup — fire and forget
  db.insert(cartItems)
    .values({ id: crypto.randomUUID(), ownerId, productId, variantId, qty })
    .onDuplicateKeyUpdate({ set: { qty } })
    .catch(console.error)
}

// ── zmień ilość ────────────────────────────────────
export async function updateQty(productId: string, qty: number, variantId?: string) {
  const ownerId = await getOwnerId()
  const key = `cart:${ownerId}`

  const raw = await redis.get(key)
  const cart: CartItem[] = raw ? JSON.parse(raw) : []

  const item = cart.find(
    i => i.productId === productId && i.variantId === variantId
  )

  if (!item) return

  if (qty <= 0) {
    // usuń jeśli qty = 0
    const filtered = cart.filter(
      i => !(i.productId === productId && i.variantId === variantId)
    )
    await redis.setEx(key, 60 * 60 * 24 * 30, JSON.stringify(filtered))
  } else {
    item.qty = qty
    await redis.setEx(key, 60 * 60 * 24 * 30, JSON.stringify(cart))
  }

  // sync MySQL
  db.update(cartItems)
    .set({ qty })
    .where(and(
      eq(cartItems.ownerId, ownerId),
      eq(cartItems.productId, productId),
    ))
    .catch(console.error)
}

// ── usuń produkt ───────────────────────────────────
export async function removeFromCart(productId: string, variantId?: string) {
  return updateQty(productId, 0, variantId)
}

// ── wyczyść koszyk ─────────────────────────────────
export async function clearCart() {
  const ownerId = await getOwnerId()

  await Promise.all([
    redis.del(`cart:${ownerId}`),
    db.delete(cartItems).where(eq(cartItems.ownerId, ownerId)),
  ])
}

// ── merge gościa po zalogowaniu ────────────────────
export async function mergeGuestCart(guestId: string, userId: string) {
  const [guestRaw, userRaw] = await Promise.all([
    redis.get(`cart:${guestId}`),
    redis.get(`cart:${userId}`),
  ])

  const guestCart: CartItem[] = guestRaw ? JSON.parse(guestRaw) : []
  const userCart: CartItem[]  = userRaw  ? JSON.parse(userRaw)  : []

  if (!guestCart.length) return

  // user cart ma priorytet przy konflikcie productId+variantId
  const merged = [...userCart]

  for (const guestItem of guestCart) {
    const conflict = merged.find(
      i => i.productId === guestItem.productId && i.variantId === guestItem.variantId
    )
    if (!conflict) merged.push(guestItem)
  }

  await Promise.all([
    redis.setEx(`cart:${userId}`, 60 * 60 * 24 * 30, JSON.stringify(merged)),
    redis.del(`cart:${guestId}`),
  ])
}