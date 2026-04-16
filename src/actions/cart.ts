// src/actions/cart.ts
'use server'

import { auth } from '@clerk/nextjs/server'
import { redis } from '@/lib/redis'
import { db } from '@/lib/db'
import { cartItems } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { cookies } from 'next/headers'

export type ServerCartItem = {
  productId: string
  variantId: string
  qty:       number
  // snapshot ceny — żeby nie było rozbieżności przy checkout
  priceCents: number
  name:       string
  image:      string
  slug:       string
}

const cartKey = (id: string) => `cart:${id}`

async function getOwnerId(): Promise<string> {
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

// ── sync koszyka do Redis+MySQL ─────────────────────
// wywołujesz to ze Zustand store po każdej zmianie (debounced)
export async function syncCart(items: ServerCartItem[]): Promise<void> {
  const ownerId = await getOwnerId()
  const key = cartKey(ownerId)

  if (!items.length) {
    await Promise.all([
      redis.del(key),
      db.delete(cartItems).where(eq(cartItems.ownerId, ownerId)),
    ])
    return
  }

  // Redis — cały koszyk jako JSON, jeden strzał
  await redis.setEx(key, 60 * 60 * 24 * 30, JSON.stringify(items))

  // MySQL — upsert każdego itemu
  await db
    .insert(cartItems)
    .values(
      items.map(i => ({
        id:         crypto.randomUUID(),
        ownerId,
        productId:  i.productId,
        variantId:  i.variantId,
        qty:        i.qty,
        priceCents: i.priceCents,
      }))
    )
    .onDuplicateKeyUpdate({ set: { qty: db.raw('VALUES(qty)') } })
}

// ── pobierz koszyk z serwera (hydration przy starcie) ─
export async function fetchCart(): Promise<ServerCartItem[]> {
  const ownerId = await getOwnerId()
  const raw = await redis.get(cartKey(ownerId))
  return raw ? JSON.parse(raw) : []
}

// ── merge gościa po zalogowaniu ─────────────────────
export async function mergeGuestCart(): Promise<void> {
  const { userId } = await auth()
  if (!userId) return

  const cookieStore = await cookies()
  const guestId = cookieStore.get('guest_id')?.value
  if (!guestId) return

  const [guestRaw, userRaw] = await Promise.all([
    redis.get(cartKey(guestId)),
    redis.get(cartKey(userId)),
  ])

  const guestItems: ServerCartItem[] = guestRaw ? JSON.parse(guestRaw) : []
  const userItems:  ServerCartItem[] = userRaw  ? JSON.parse(userRaw)  : []

  if (!guestItems.length) return

  // merge — user ma priorytet przy tym samym productId+variantId
  const merged = [...userItems]
  for (const guestItem of guestItems) {
    const conflict = merged.find(
      i => i.productId === guestItem.productId && i.variantId === guestItem.variantId
    )
    if (!conflict) merged.push(guestItem)
  }

  await Promise.all([
    redis.setEx(cartKey(userId), 60 * 60 * 24 * 30, JSON.stringify(merged)),
    redis.del(cartKey(guestId)),
    db.delete(cartItems).where(eq(cartItems.ownerId, guestId)),
  ])

  cookieStore.delete('guest_id')
}