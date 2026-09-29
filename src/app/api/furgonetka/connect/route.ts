import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAuthorizeUrl, getOAuthRedirectUri, normalizeRedirectUri, setOAuthRedirectUri } from '@/lib/furgonetka'

// Start autoryzacji OAuth Furgonetki — tylko admin.
// GET /api/furgonetka/connect?redirect_uri=<adres zarejestrowany w aplikacji Furgonetki>
// Bez parametru: adres z ostatniej autoryzacji (Redis) albo z .env.
export async function GET(req: NextRequest) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const requested = req.nextUrl.searchParams.get('redirect_uri')
  let redirectUri: string
  if (requested) {
    const normalized = normalizeRedirectUri(requested)
    if (!normalized) return NextResponse.json({ error: 'Nieprawidłowy adres przekierowania' }, { status: 400 })
    redirectUri = normalized
    await setOAuthRedirectUri(redirectUri)
  } else {
    redirectUri = await getOAuthRedirectUri()
  }

  return NextResponse.redirect(getAuthorizeUrl(redirectUri))
}
