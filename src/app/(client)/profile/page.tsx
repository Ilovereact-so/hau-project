import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

// /profile nie ma własnej treści: zalogowany trafia na dane konta,
// gość na swoją wishlistę (jedyną sekcję profilu dostępną bez konta).
export default async function ProfileIndex() {
  const { userId } = await auth()
  redirect(userId ? '/profile/account' : '/profile/wishlist')
}
