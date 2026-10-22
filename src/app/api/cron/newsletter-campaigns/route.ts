import { NextRequest, NextResponse } from 'next/server'
import { hasBearer } from '@/lib/server/secrets'
import { processCampaigns } from '@/lib/campaigns/campaigns.server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET|POST /api/cron/newsletter-campaigns — `Authorization: Bearer <CRON_SECRET>`
 *
 * Kampanie newslettera: uruchamia zaplanowane, których czas minął, i wysyła
 * kolejne partie w granicach limitów (NEWSLETTER_RATE_PER_MINUTE,
 * NEWSLETTER_DAILY_LIMIT). Uruchamiaj co 5–15 minut — wtedy kampania
 * dokończy się sama także przy zamkniętym panelu, a zaplanowana wystartuje
 * najwyżej kilka minut po czasie. Działa maks. ~4,5 min na wywołanie.
 */
async function handle(req: NextRequest) {
  if (!hasBearer(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const started = Date.now()
  try {
    const report = await processCampaigns({ budgetMs: 270_000 })
    return NextResponse.json({ ok: true, ...report, durationMs: Date.now() - started })
  } catch (err) {
    console.error('[cron/newsletter-campaigns] failed', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
