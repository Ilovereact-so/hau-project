import { WishlistPageClient } from '@/components/WishlistPageClient'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function WishlistPage() {
  const { userId } = await auth()
  if (!userId) redirect('/logowanie')
  // brak fetch tutaj — wszystko w StoreHydration przez /api/wishlist
  return <WishlistPageClient />
}