'use server'

import { auth } from '@clerk/nextjs/server'
import { sanityClient } from '@/sanity/sanityClient.server'
import { redis } from '@/lib/redis'

async function requireAdmin() {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') throw new Error('Forbidden')
}

const WISHLIST_NAMES_CACHE = 'admin:insights:wishlistNames'
const WISHLIST_NAMES_TTL = 300 // 5 min — nazwy produktów rzadko się zmieniają

/** Mapa productId → nazwa (z cache; fallback do Sanity). */
export async function adminGetProductNames(ids: string[]): Promise<Record<string, string>> {
  await requireAdmin()
  if (!ids.length) return {}

  const unique = [...new Set(ids)]
  const cached = await redis.get(WISHLIST_NAMES_CACHE)
  const cacheMap = cached ? (JSON.parse(cached as string) as Record<string, string>) : {}

  const missing = unique.filter(id => !cacheMap[id])
  if (missing.length) {
    const QUERY = `*[_type == "product" && _id in $ids]{ _id, title }`
    try {
      const rows = (await sanityClient.fetch(QUERY, { ids: missing })) as Array<{ _id: string; title?: string }>
      for (const r of rows) cacheMap[r._id] = r.title ?? '(bez nazwy)'
      for (const id of missing) if (!cacheMap[id]) cacheMap[id] = '(produkt usunięty)'
      await redis.setEx(WISHLIST_NAMES_CACHE, WISHLIST_NAMES_TTL, JSON.stringify(cacheMap))
    } catch {
      for (const id of missing) cacheMap[id] = '(błąd nazwy)'
    }
  }

  return Object.fromEntries(unique.map(id => [id, cacheMap[id] ?? '(nieznany)']))
}

/** Wyczyść cache nazw (np. po imporcie produktów). */
export async function adminInvalidateProductNamesCache() {
  await requireAdmin()
  await redis.del(WISHLIST_NAMES_CACHE)
}
