import { NextRequest, NextResponse } from 'next/server'
import { unsubscribeNewsletter } from '@/actions/newsletter'
import { absoluteUrl } from '@/lib/site'

export const dynamic = 'force-dynamic'

/*
 * Wypisanie z newslettera „jednym kliknięciem” (RFC 8058).
 *
 * Każdy mail kampanii ma nagłówki
 *   List-Unsubscribe: <https://…/api/newsletter/unsubscribe?token=…>
 *   List-Unsubscribe-Post: List-Unsubscribe=One-Click
 * — Gmail, Yahoo i Apple Mail pokazują wtedy przycisk „Anuluj subskrypcję”
 * obok nadawcy i same wysyłają POST na ten adres (bez wchodzenia na stronę).
 * Od 2024 r. Gmail i Yahoo wymagają tego od nadawców wysyłek masowych.
 *
 * GET (np. ktoś otworzy adres w przeglądarce) prowadzi na zwykłą stronę
 * wypisania z przyciskiem — skanery linków nie wypiszą nikogo przypadkiem.
 */

const tokenFrom = (req: NextRequest) => req.nextUrl.searchParams.get('token') ?? ''

export async function POST(req: NextRequest) {
  const result = await unsubscribeNewsletter(tokenFrom(req))
  // Klient poczty oczekuje 2xx; treść odpowiedzi nie jest nigdzie pokazywana.
  return NextResponse.json(result.ok ? { ok: true } : { ok: false }, { status: result.ok ? 200 : 404 })
}

export async function GET(req: NextRequest) {
  const token = tokenFrom(req)
  return NextResponse.redirect(absoluteUrl(`/newsletter/wypisz${token ? `?token=${encodeURIComponent(token)}` : ''}`))
}
