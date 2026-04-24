import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { redis } from '@/lib/redis'

// Clears cached Furgonetka tokens from Redis — forces re-auth on next request
export async function POST() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await Promise.all([
    redis.del('furgonetka:access_token'),
    redis.del('furgonetka:refresh_token'),
    redis.del('furgonetka:services'),
  ])

  return NextResponse.json({ ok: true, message: 'Redis tokens cleared. Now visit /api/furgonetka/connect' })
}
