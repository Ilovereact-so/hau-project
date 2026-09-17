import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

/** Adres profilu gościa z otwartym modalem logowania i powrotem na `returnTo`. */
export function guestProfileLoginUrl(returnTo: string) {
  const params = new URLSearchParams({ login: '1', redirect_url: returnTo })
  return `/profile/wishlist?${params.toString()}`
}

/**
 * Druga linia obrony dla sekcji konta (pierwszą jest middleware): gość jest
 * odsyłany na swoją wishlistę z modalem logowania.
 */
export async function requireUser(returnTo: string): Promise<string> {
  const { userId } = await auth()
  if (!userId) redirect(guestProfileLoginUrl(returnTo))
  return userId
}
