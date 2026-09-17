// PUT /api/cart — zapis koszyka wysyłany przez `fetch(..., { keepalive: true })`
// przy zamykaniu/ukrywaniu karty. Akcji serwerowej nie da się tak wywołać,
// a bez tego zmiana zrobiona <500 ms przed zamknięciem karty (debounce)
// przepadała. Logika i zabezpieczenia identyczne jak w `syncCart`.
import { NextRequest, NextResponse } from 'next/server'
import { syncCart } from '@/actions/sync'
import { isSameOrigin } from '@/lib/sameOrigin'

export async function PUT(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ ok: false }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const { items, owner } = (body ?? {}) as { items?: unknown; owner?: unknown }
  if (typeof owner !== 'string' || !Array.isArray(items)) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  try {
    // syncCart sam sanityzuje pozycje i weryfikuje właściciela.
    await syncCart(items as never, owner)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/cart] PUT failed', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
