import { auth } from '@clerk/nextjs/server'
import { redis } from '@/lib/redis'
import { getProductForWishList } from '@/sanity/helpers/clientRequest'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ ids: [], products: [] })
  }

  const ids = await redis.sMembers(`wishlist:${userId}`)

  if (!ids.length) {
    return NextResponse.json({ ids: [], products: [] })
  }

  const products = await getProductForWishList(ids)

  return NextResponse.json(
    { ids, products },
    // no-store — wishlist zawsze świeża, żaden cache nie może ukryć zmian
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}