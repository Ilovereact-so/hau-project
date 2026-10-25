import { NextRequest, NextResponse } from 'next/server'
import { hasBearer } from '@/lib/server/secrets'
import { processUnpaidOrders } from '@/lib/unpaidOrders.server'
import { sendUnpaidOrderEmail } from '@/lib/orderEmails'
import { reconcileOrderStock } from '@/lib/inventory.server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET|POST /api/cron/unpaid-orders — `Authorization: Bearer <CRON_SECRET>`
 *
 * Nieopłacone zamówienia (uruchamiaj co godzinę, jak rejestr cen):
 *  - przypomnienie mailem ok. 1 h po złożeniu,
 *  - ostatnie przypomnienie 12 h przed terminem,
 *  - po terminie (`ORDER_PAYMENT_DEADLINE_HOURS`, domyślnie 72 h) anulowanie:
 *    status „Anulowane”, kod rabatowy wraca do puli, mail do klienta.
 * Każdy mail idzie najwyżej raz (Redis). Anulowanie działa też bez crona —
 * przy wejściu na zamówienie i próbie zapłaty — ale maile wysyła tylko cron.
 *
 * Przy okazji: dogrywka zdejmowania stanu dla zamówień opłaconych, którym
 * stan nie zszedł (awaria Sanity w chwili ITN) — `reconcileOrderStock`.
 */
async function handle(req: NextRequest) {
  if (!hasBearer(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const started = Date.now()
  try {
    const report = await processUnpaidOrders(sendUnpaidOrderEmail)
    let stock: Awaited<ReturnType<typeof reconcileOrderStock>> | { error: string }
    try {
      stock = await reconcileOrderStock()
    } catch (err) {
      console.error('[cron/unpaid-orders] stock reconcile failed', err)
      stock = { error: 'failed' }
    }
    const stockFailed = 'error' in stock || stock.failed > 0
    const ok = report.failed.length === 0 && !stockFailed
    return NextResponse.json(
      { ok, ...report, stock, durationMs: Date.now() - started },
      { status: ok ? 200 : 500 },
    )
  } catch (err) {
    console.error('[cron/unpaid-orders] failed', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
