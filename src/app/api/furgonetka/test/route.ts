import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { redis } from '@/lib/redis'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const BASE_URL      = 'https://api.sandbox.furgonetka.pl'
  const CLIENT_ID     = process.env.FURGONETKA_CLIENT_ID!
  const CLIENT_SECRET = process.env.FURGONETKA_CLIENT_SECRET!

  const refreshToken =
    (await redis.get('furgonetka:refresh_token') as string | null) ??
    process.env.FURGONETKA_REFRESH_TOKEN

  // ── 1. exchange refresh token ─────────────────────────────────────────────
  const tokenRes = await fetch(`${BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken!.trim(),
    }),
  })

  const tokenText = await tokenRes.text()

  if (!tokenRes.ok) {
    return NextResponse.json({ step: 'token_exchange', status: tokenRes.status, body: tokenText })
  }

  const tokenData = JSON.parse(tokenText)

  if (!tokenData.access_token) {
    return NextResponse.json({ step: 'token_parse', tokenData })
  }

  // ── 2. call services ──────────────────────────────────────────────────────
  const r    = await fetch(`${BASE_URL}/account/services`, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept:        'application/vnd.furgonetka.v1+json',
    },
  })
  const text = await r.text()

  return NextResponse.json({
    token_type:    tokenData.token_type,
    access_prefix: String(tokenData.access_token).slice(0, 30) + '…',
    services_status: r.status,
    services_body:   text.slice(0, 3000),
  })
}
