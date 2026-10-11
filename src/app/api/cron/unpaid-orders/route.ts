import { NextRequest, NextResponse } from 'next/server'
import { hasBearer } from '@/lib/server/secrets'
import { processUnpaidOrders } from '@/lib/unpaidOrders.server'
import { sendUnpaidOrderEmail } from '@/lib/orderEmails'

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
 */
async function handle(req: NextRequest) {
  if (!hasBearer(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const started = Date.now()
  try {
    const report = await processUnpaidOrders(sendUnpaidOrderEmail)
    return NextResponse.json(
      { ok: report.failed.length === 0, ...report, durationMs: Date.now() - started },
      { status: report.failed.length ? 500 : 200 },
    )
  } catch (err) {
    console.error('[cron/unpaid-orders] failed', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
