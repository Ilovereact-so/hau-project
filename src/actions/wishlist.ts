'use server'

import { auth } from '@clerk/nextjs/server'
import { redis } from '@/lib/redis'
import { db } from '@/lib/db'
import { wishlistItems } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

const key = (userId: string) => `wishlist:${userId}`

export async function toggleWishlist(productId: string): Promise<{ wishlisted: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const isMember = await redis.sIsMember(key(userId), productId)

  if (isMember) {
    await Promise.all([
      redis.sRem(key(userId), productId),
      db.delete(wishlistItems).where(
        and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, productId))
      ),
    ])
    return { wishlisted: false }
  }

  await Promise.all([
    redis.sAdd(key(userId), productId),
    db.insert(wishlistItems)
      .values({ userId, productId })
      .onDuplicateKeyUpdate({ set: { userId, productId } }),
  ])
  return { wishlisted: true }
}

export async function syncWishlist(productIds: string[]): Promise<void> {
  const { userId } = await auth()
  if (!userId) return

  const k = key(userId)
  await redis.del(k)
  if (productIds.length) {
    await redis.sAdd(k, productIds)
    await redis.expire(k, 60 * 60 * 24 * 30)
  }

  await db.delete(wishlistItems).where(eq(wishlistItems.userId, userId))
  if (productIds.length) {
    await db.insert(wishlistItems).values(
      productIds.map(productId => ({ userId, productId }))
    )
  }
}