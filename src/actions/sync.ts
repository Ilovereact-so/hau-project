// src/actions/sync.ts
'use server'

import { auth } from '@clerk/nextjs/server'
import { redis } from '@/lib/redis'
import { db } from '@/lib/db'
import { cartItems, wishlistItems } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { cookies } from 'next/headers'

type CartSyncItem = {
  productId: string
  variantId: string
  qty:       number
}

async function getOwnerId() {
  const { userId } = await auth()
  if (userId) return userId

  const cookieStore = await cookies()
  const existing = cookieStore.get('guest_id')?.value
  if (existing) return existing

  const guestId = `guest_${crypto.randomUUID()}`
  cookieStore.set('guest_id', guestId, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   60 * 60 * 24 * 30,
    sameSite: 'lax',
  })
  return guestId
}

export async function syncCart(items: CartSyncItem[]): Promise<void> {
  const ownerId = await getOwnerId()

  if (!items.length) {
    await Promise.all([
      redis.del(`cart:${ownerId}`),
      db.delete(cartItems).where(eq(cartItems.ownerId, ownerId)),
    ])
    return
  }

  await redis.setEx(`cart:${ownerId}`, 60 * 60 * 24 * 30, JSON.stringify(items))

  // upsert — sql`VALUES(qty)` to prawidłowa Drizzle składnia dla MySQL
  await db
    .insert(cartItems)
    .values(items.map(i => ({
      id:        crypto.randomUUID(),
      ownerId,
      productId: i.productId,
      variantId: i.variantId,
      qty:       i.qty,
    })))
    .onDuplicateKeyUpdate({
      set: { qty: sql`VALUES(qty)` },
    })
}

export async function syncWishlist(productIds: string[]): Promise<void> {
  const { userId } = await auth()
  if (!userId) return

  const key = `wishlist:${userId}`

  if (!productIds.length) {
    await Promise.all([
      redis.del(key),
      db.delete(wishlistItems).where(eq(wishlistItems.userId, userId)),
    ])
    return
  }

  // Redis — zastąp cały set
  await redis.del(key)
  await redis.sAdd(key, productIds)
  await redis.expire(key, 60 * 60 * 24 * 30)

  // MySQL — usuń stare, wstaw nowe
  await db.delete(wishlistItems).where(eq(wishlistItems.userId, userId))
  await db.insert(wishlistItems).values(
    productIds.map(productId => ({ userId, productId }))
  )
}

export async function fetchServerCart(): Promise<CartSyncItem[]> {
  const ownerId = await getOwnerId()
  const raw = await redis.get(`cart:${ownerId}`)
  return raw ? JSON.parse(raw) : []
}

export async function fetchServerWishlist(): Promise<string[]> {
  const { userId } = await auth()
  if (!userId) return []
  return redis.sMembers(`wishlist:${userId}`)
}

export async function mergeGuestCart(): Promise<void> {
  const { userId } = await auth()
  if (!userId) return

  const cookieStore = await cookies()
  const guestId = cookieStore.get('guest_id')?.value
  if (!guestId) return

  const [guestRaw, userRaw] = await Promise.all([
    redis.get(`cart:${guestId}`),
    redis.get(`cart:${userId}`),
  ])

  const guestItems: CartSyncItem[] = guestRaw ? JSON.parse(guestRaw) : []
  const userItems:  CartSyncItem[] = userRaw  ? JSON.parse(userRaw)  : []

  if (!guestItems.length) return

  const merged = [...userItems]
  for (const g of guestItems) {
    const conflict = merged.find(
      i => i.productId === g.productId && i.variantId === g.variantId
    )
    if (!conflict) merged.push(g)
  }

  await Promise.all([
    redis.setEx(`cart:${userId}`, 60 * 60 * 24 * 30, JSON.stringify(merged)),
    redis.del(`cart:${guestId}`),
    db.delete(cartItems).where(eq(cartItems.ownerId, guestId)),
  ])

  cookieStore.delete('guest_id')
}