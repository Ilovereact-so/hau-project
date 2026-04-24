import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAuthorizeUrl } from '@/lib/furgonetka'

// One-time OAuth setup — admin only
// Visit: GET /api/furgonetka/connect
export async function GET() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.redirect(getAuthorizeUrl())
}
