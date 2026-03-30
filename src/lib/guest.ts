import 'server-only'
import { cookies } from 'next/headers'

export async function getOrCreateGuestId(): Promise<string> {
  const cookieStore = await cookies()
  const existing = cookieStore.get('guest_id')?.value

  if (existing) return existing

  const guestId = `guest_${crypto.randomUUID()}`

  cookieStore.set('guest_id', guestId, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   60 * 60 * 24 * 30, // 30 dni
    sameSite: 'lax',
  })

  return guestId
}