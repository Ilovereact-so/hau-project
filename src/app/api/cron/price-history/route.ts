import { NextRequest, NextResponse } from 'next/server'
import { syncAllProductPrices } from '@/lib/priceHistory'
import { hasBearer } from '@/lib/server/secrets'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET|POST /api/cron/price-history — `Authorization: Bearer <CRON_SECRET>`
 *
 * Uzgadnia rejestr cen WSZYSTKICH produktów z Sanity. Siatka bezpieczeństwa
 * dla zmian, których nie zgłosił panel ani webhook (np. produkt, którego nikt
 * nie oglądał). Pierwsze wywołanie po wdrożeniu zakłada historię wszystkim
 * produktom. Uruchamiaj co godzinę (cron na hostingu albo
 * .github/workflows/price-history-cron.yml).
 */
async function handle(req: NextRequest) {
  if (!hasBearer(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const started = Date.now()
  try {
    const result = await syncAllProductPrices('cron')
    return NextResponse.json(
      { ok: result.failed.length === 0, ...result, durationMs: Date.now() - started },
      { status: result.failed.length ? 500 : 200 },
    )
  } catch (err) {
    console.error('[cron/price-history] failed', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
