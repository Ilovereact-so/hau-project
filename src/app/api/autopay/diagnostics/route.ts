import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  autopayEnvironment,
  isAutopayConfigured,
  fetchGateways,
  buildTransactionRequest,
  AUTOPAY_CARD_IFRAME_ENABLED,
} from '@/lib/autopay'

export const dynamic = 'force-dynamic'
export const runtime  = 'nodejs'

/**
 * Narzędzie diagnostyczne integracji Autopay — wyłącznie dla admina, zablokowane
 * na produkcji. Sprawdza konfigurację, łączność z bramką i poprawność hasha
 * na przykładowej transakcji (nic nie jest wysyłane do Autopay poza paywayList).
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const env    = autopayEnvironment()
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')

  const config = {
    configured:        isAutopayConfigured(),
    environment:       env.environment,
    baseUrl:           env.baseUrl,
    serviceId:         env.serviceId || null,
    hashAlgo:          process.env.AUTOPAY_HASH_ALGO ?? 'sha256',
    hashSeparator:     process.env.AUTOPAY_HASH_SEPARATOR ?? '|',
    sendReturnUrl:     process.env.AUTOPAY_SEND_RETURN_URL === 'true',
    cardIframeEnabled: AUTOPAY_CARD_IFRAME_ENABLED,
    appUrl:            appUrl || null,
    expectedItnUrl:    appUrl ? `${appUrl}/api/webhooks/autopay` : null,
    expectedReturnUrl: appUrl ? `${appUrl}/api/autopay/return`   : null,
    warnings: [
      !isAutopayConfigured() && 'Brak AUTOPAY_SERVICE_ID lub AUTOPAY_HASH_KEY.',
      appUrl.includes('localhost') &&
        'NEXT_PUBLIC_APP_URL wskazuje na localhost — Autopay nie dostarczy tam ITN.',
      appUrl.startsWith('http://') &&
        'NEXT_PUBLIC_APP_URL nie używa https — wymagane poza środowiskiem testowym.',
    ].filter(Boolean),
  }

  if (!isAutopayConfigured()) {
    return NextResponse.json({ config, paywayList: null, sampleTransaction: null })
  }

  let sampleTransaction: unknown = null
  let sampleError: string | null = null
  try {
    sampleTransaction = buildTransactionRequest({
      orderId:       '00000000-0000-4000-8000-000000000000',
      amount:        '1.00',
      description:   'Test diagnostyczny',
      customerEmail: 'test@example.com',
      returnUrl:     config.expectedReturnUrl ?? undefined,
    })
  } catch (err) {
    sampleError = (err as Error).message
  }

  let paywayList: unknown = null
  let paywayError: string | null = null
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const gateways = await fetchGateways(controller.signal).finally(() => clearTimeout(timeout))
    paywayList = { count: gateways.length, gateways }
  } catch (err) {
    paywayError = (err as Error).message
  }

  return NextResponse.json({
    config,
    paywayList,
    paywayError,
    sampleTransaction,
    sampleError,
  })
}
