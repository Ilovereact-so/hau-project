import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { connectWithPastedCode } from '@/lib/furgonetka'

// Powrót z autoryzacji OAuth Furgonetki — działa tylko tam, gdzie zarejestrowany
// adres przekierowania (localhost) faktycznie wskazuje na sklep, czyli lokalnie.
// Na serwerze admin wkleja adres z paska w /admin/settings (connectWithPastedCode).
//
// Tokenów NIE wypisujemy ani do logu, ani na stronę: refresh token jest rotowany
// i żyje w Redisie, więc kopia w `.env` szybko by umarła, a w logu serwera byłaby
// zwykłym wyciekiem sekretu.
export async function GET(req: NextRequest) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let error: string | null = null
  try {
    // Sam ciąg zapytania (code / error) — adres wymiany bierze się z ustawień,
    // tak samo jak przy /oauth/authorize.
    await connectWithPastedCode(`?${req.nextUrl.searchParams.toString()}`)
  } catch (err) {
    error = err instanceof Error ? err.message : 'Nie udało się połączyć z Furgonetką.'
  }

  return new NextResponse(page(error), {
    status: error ? 400 : 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

function page(error: string | null): string {
  const title = error ? 'Furgonetka — błąd autoryzacji' : 'Furgonetka — połączono'
  const body = error
    ? `<h1>Nie udało się połączyć</h1><p>${escapeHtml(error)}</p>`
    : '<h1>Furgonetka połączona</h1><p>Token zapisano po stronie serwera — przesyłki i punkty odbioru działają od razu.</p>'
  return `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f4f4f4}
.box{background:#fff;border-radius:16px;padding:40px;max-width:520px;width:100%;box-sizing:border-box}
h1{color:#20201F;margin:0 0 12px;font-size:22px}p{color:#555;margin:0 0 20px;line-height:1.5}
a{color:#20201F;font-weight:600}</style></head>
<body><div class="box">${body}<p><a href="/admin/settings">Wróć do ustawień panelu</a></p></div></body></html>`
}
