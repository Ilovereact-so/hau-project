import { NextResponse } from 'next/server'
import {
  fetchGateways,
  isAutopayConfigured,
  AUTOPAY_CARD_IFRAME_ENABLED,
  AUTOPAY_ONECLICK_GATEWAY_ID,
  type AutopayGateway,
} from '@/lib/autopay'

export const dynamic = 'force-dynamic'
export const runtime  = 'nodejs'

/**
 * Lista kanałów płatności Autopay dla widoku checkoutu.
 *
 * Wymaga włączonej usługi white-label po stronie Autopay. Gdy Autopay nie jest
 * skonfigurowany, w trybie deweloperskim zwracamy mocki, żeby dało się przejść
 * cały flow zamówienia bez realnych danych.
 */

const DEV_GATEWAYS: AutopayGateway[] = [
  { gatewayID: 509,  gatewayName: 'BLIK',             gatewayType: 'BLIK',                  bankName: 'BLIK',   iconURL: '' },
  { gatewayID: 1500, gatewayName: 'Karta płatnicza',  gatewayType: 'Karta płatnicza',       bankName: 'Karty',  iconURL: '' },
  { gatewayID: 1512, gatewayName: 'Google Pay',       gatewayType: 'Portfel elektroniczny', bankName: 'Karty',  iconURL: '' },
  { gatewayID: 1513, gatewayName: 'Apple Pay',        gatewayType: 'Portfel elektroniczny', bankName: 'Karty',  iconURL: '' },
  { gatewayID: 21,   gatewayName: 'Szybki przelew',   gatewayType: 'Szybki Przelew',        bankName: '',       iconURL: '' },
]

const CACHE_TTL_MS = 5 * 60 * 1000

/** Flagi trybów płatności — czyta je checkout. */
const FEATURE_FLAGS = {
  cardIframeEnabled:  AUTOPAY_CARD_IFRAME_ENABLED,
}

/**
 * One Click (1503) wymaga zapisanej karty — usługa niedostępna na umowie
 * sklepu, więc kanału nie pokazujemy, nawet gdyby bramka go zwróciła.
 */
const visibleGateways = (gateways: AutopayGateway[]) =>
  gateways.filter(gateway => gateway.gatewayID !== AUTOPAY_ONECLICK_GATEWAY_ID)

let cache: { at: number; gateways: AutopayGateway[] } | null = null

export async function GET() {
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isAutopayConfigured()) {
    if (isProduction) {
      return NextResponse.json(
        { error: 'Płatności online są chwilowo niedostępne' },
        { status: 503 },
      )
    }
    return NextResponse.json({ gateways: DEV_GATEWAYS, dev: true, ...FEATURE_FLAGS })
  }

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ gateways: cache.gateways, ...FEATURE_FLAGS })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const gateways = visibleGateways(
      await fetchGateways(controller.signal).finally(() => clearTimeout(timeout)),
    )

    cache = { at: Date.now(), gateways }
    return NextResponse.json({ gateways, ...FEATURE_FLAGS })
  } catch (err) {
    console.error('[Autopay] Nie udało się pobrać listy kanałów płatności:', err)

    // Lista kanałów jest wygodą, nie warunkiem płatności — pozwalamy zapłacić
    // przez wybór metody na stronie Autopay.
    if (cache) {
      return NextResponse.json({
        gateways:         cache.gateways,
        stale:            true,
        ...FEATURE_FLAGS,
      })
    }

    return NextResponse.json({
      gateways:         [],
      unavailable:      true,
      ...FEATURE_FLAGS,
    })
  }
}
