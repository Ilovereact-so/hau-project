import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { exchangeCodeForTokens } from '@/lib/furgonetka'
import { redis } from '@/lib/redis'

// Furgonetka redirects here after user grants access
// Stores refresh_token in Redis and prints instructions
export async function GET(req: NextRequest) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const code = req.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.json({ error: 'Missing code param' }, { status: 400 })
  }

  const tokens = await exchangeCodeForTokens(code)

  // store in Redis immediately so the app can use them
  await Promise.all([
    redis.setEx('furgonetka:access_token', tokens.expires_in - 60, tokens.access_token),
    redis.set('furgonetka:refresh_token', tokens.refresh_token),
  ])

  // Print to server console so dev can copy to .env
  console.info('\n✅ FURGONETKA OAUTH SUCCESS')
  console.info('────────────────────────────────────────')
  console.info('Add to .env:')
  console.info(`FURGONETKA_REFRESH_TOKEN=${tokens.refresh_token}`)
  console.info('────────────────────────────────────────\n')

  return new NextResponse(
    `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><title>Furgonetka — połączono</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f4f4f4}
.box{background:#fff;border-radius:16px;padding:40px;max-width:520px;width:100%;box-shadow:0 2px 16px rgba(0,0,0,.08)}
h1{color:#20201F;margin:0 0 12px}p{color:#555;margin:0 0 20px}
pre{background:#f0f0f0;padding:16px;border-radius:8px;font-size:13px;word-break:break-all;white-space:pre-wrap}
.note{font-size:13px;color:#888}</style></head>
<body><div class="box">
<h1>✅ Furgonetka połączona!</h1>
<p>Skopiuj poniższy refresh_token i wklej do <strong>.env</strong>:</p>
<pre>FURGONETKA_REFRESH_TOKEN=${tokens.refresh_token}</pre>
<p class="note">Token został już zapisany w Redis — aplikacja działa od razu. Wpis do .env potrzebny jest po restarcie serwera lub nowym deploymencie.</p>
</div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
