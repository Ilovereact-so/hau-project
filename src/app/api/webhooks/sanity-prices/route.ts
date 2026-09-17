import { NextRequest, NextResponse } from 'next/server'
import { syncProductPrices } from '@/lib/priceHistory'
import { hasBearer, verifySanitySignature } from '@/lib/server/secrets'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/sanity-prices
 *
 * Webhook Sanity (GROQ-powered) dla dokumentów `product` — po publikacji,
 * zmianie lub usunięciu produktu w Studio rejestruje zmianę ceny od razu.
 * Treść żądania służy tylko do ustalenia `_id`: ceny i tak pobieramy
 * świeżo z Sanity, więc sfałszowane dane nie trafią do rejestru.
 *
 * Konfiguracja (sanity.io/manage → API → Webhooks):
 *   URL:        https://<sklep>/api/webhooks/sanity-prices
 *   Dataset:    production, Trigger on: Create, Update, Delete
 *   Filter:     _type == "product"
 *   Projection: {_id}
 *   Secret:     wartość SANITY_PRICE_WEBHOOK_SECRET
 *   (drafty wyłączone — rejestrujemy tylko ceny opublikowane)
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SANITY_PRICE_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  const body = await req.text()
  const authorized =
    verifySanitySignature(req.headers.get('sanity-webhook-signature'), body, secret) ||
    hasBearer(req.headers.get('authorization'), secret)
  if (!authorized) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let ids: string[] = []
  try {
    const payload = JSON.parse(body) as unknown
    const items = Array.isArray(payload) ? payload : [payload]
    ids = items
      .map((item) => (item && typeof item === 'object' ? (item as { _id?: unknown })._id : undefined))
      .filter((id): id is string => typeof id === 'string')
    const headerId = req.headers.get('sanity-document-id')
    if (headerId) ids.push(headerId)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Szkice nie są w sklepie — zmiana szkicu nie zmienia ceny.
  ids = [...new Set(ids.filter((id) => !id.startsWith('drafts.')))].slice(0, 200)
  if (!ids.length) return NextResponse.json({ ok: true, checked: 0, changed: 0 })

  try {
    const result = await syncProductPrices(ids, 'webhook')
    // Błąd = 500, żeby Sanity ponowiło dostarczenie.
    const status = result.failed.length ? 500 : 200
    return NextResponse.json({ ok: status === 200, ...result }, { status })
  } catch (err) {
    console.error('[webhooks/sanity-prices] failed', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
