import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { sanityClient } from '@/sanity/sanityClient.server'
import { smtpTransporter, MAIL_FROM } from '@/lib/mail'
import {
  AUTOPAY_BLIK0_ENABLED,
  AUTOPAY_CARD_IFRAME_ENABLED,
  AUTOPAY_RECURRING_ENABLED,
  autopayEnvironment,
  fetchGateways,
  isAutopayConfigured,
} from '@/lib/autopay'
import { getAvailableServices } from '@/lib/furgonetka'

/*
 * Stan integracji sklepu dla ekranu „Integracje”. Żadna wartość sekretna
 * nie opuszcza serwera — pokazujemy tylko, CZY zmienna jest ustawiona.
 */

export type CheckState = 'ok' | 'warn' | 'error' | 'off'

export type IntegrationCheck = {
  id: string
  name: string
  state: CheckState
  summary: string
  details: Array<{ label: string; value: string }>
  warnings: string[]
  /** Można uruchomić test połączenia z zewnętrznym API na żądanie. */
  testable?: boolean
}

const has = (name: string) => Boolean(process.env[name]?.trim())
const yesNo = (value: boolean) => (value ? 'tak' : 'nie')

function missing(names: string[]) {
  return names.filter((name) => !has(name))
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const start = Date.now()
  const value = await fn()
  return { ms: Date.now() - start, value }
}

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/+$/, '')
}

async function checkSanity(): Promise<IntegrationCheck> {
  const lacking = missing(['NEXT_PUBLIC_SANITY_PROJECT_ID', 'NEXT_PUBLIC_SANITY_DATASET', 'SANITY_API_TOKEN'])
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? ''
  const warnings: string[] = []
  if (lacking.length) warnings.push(`Brak zmiennych: ${lacking.join(', ')}.`)
  if (dataset && dataset !== 'production') {
    warnings.push(
      `NEXT_PUBLIC_SANITY_DATASET = „${dataset}”, a klient serwerowy (sanityClient.server.ts) i Studio są przypięte do „production”.`
    )
  }
  try {
    const { ms, value } = await timed(() =>
      sanityClient.fetch<{ products: number; categories: number; subcategories: number; shipping: number }>(
        `{ "products": count(*[_type == "product"]), "categories": count(*[_type == "category"]),
           "subcategories": count(*[_type == "subcategory"]), "shipping": count(*[_type == "shipping_methods"]) }`
      )
    )
    return {
      id: 'sanity',
      name: 'Sanity CMS',
      state: warnings.length ? 'warn' : 'ok',
      summary: `Połączono (${ms} ms) · ${value.products} produktów w sklepie`,
      details: [
        { label: 'Projekt', value: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '—' },
        { label: 'Dataset', value: dataset || '—' },
        { label: 'Token zapisu', value: yesNo(has('SANITY_API_TOKEN')) },
        { label: 'Kategorie / subkategorie', value: `${value.categories} / ${value.subcategories}` },
        { label: 'Metody dostawy', value: String(value.shipping) },
      ],
      warnings,
    }
  } catch (error) {
    return {
      id: 'sanity',
      name: 'Sanity CMS',
      state: 'error',
      summary: `Brak połączenia: ${(error as Error).message}`,
      details: [{ label: 'Projekt', value: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '—' }],
      warnings,
    }
  }
}

async function checkDatabase(): Promise<IntegrationCheck> {
  try {
    const { ms } = await timed(() => db.execute(sql`SELECT 1`))
    return {
      id: 'mysql',
      name: 'Baza MySQL',
      state: 'ok',
      summary: `Połączono (${ms} ms)`,
      details: [
        { label: 'Host', value: process.env.DB_HOST || '—' },
        { label: 'Baza', value: process.env.DB_NAME || '—' },
      ],
      warnings: [],
    }
  } catch (error) {
    return {
      id: 'mysql',
      name: 'Baza MySQL',
      state: 'error',
      summary: `Brak połączenia: ${(error as Error).message}`,
      details: [{ label: 'Host', value: process.env.DB_HOST || '—' }],
      warnings: missing(['DB_HOST', 'DB_USER', 'DB_NAME']).map((name) => `Brak zmiennej ${name}.`),
    }
  }
}

async function checkRedis(): Promise<IntegrationCheck> {
  try {
    const { ms } = await timed(() => redis.ping())
    return {
      id: 'redis',
      name: 'Redis (cache)',
      state: 'ok',
      summary: `Połączono (${ms} ms)`,
      details: [{ label: 'Adres', value: has('REDIS_URL') ? 'ustawiony (REDIS_URL)' : 'domyślny localhost' }],
      warnings: [],
    }
  } catch (error) {
    return {
      id: 'redis',
      name: 'Redis (cache)',
      state: 'error',
      summary: `Brak połączenia: ${(error as Error).message}`,
      details: [],
      warnings: ['Koszyk, lista życzeń i tokeny Furgonetki trzymają się w Redisie.'],
    }
  }
}

function checkClerk(): IntegrationCheck {
  const lacking = missing(['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY', 'CLERK_WEBHOOK_SECRET'])
  return {
    id: 'clerk',
    name: 'Clerk (logowanie)',
    state: lacking.length ? 'warn' : 'ok',
    summary: lacking.length ? 'Częściowa konfiguracja' : 'Skonfigurowany',
    details: [
      { label: 'Klucze API', value: yesNo(has('CLERK_SECRET_KEY')) },
      { label: 'Sekret webhooka', value: yesNo(has('CLERK_WEBHOOK_SECRET')) },
    ],
    warnings: lacking.map((name) => `Brak zmiennej ${name}.`),
  }
}

function checkAutopay(): IntegrationCheck {
  const env = autopayEnvironment()
  const configured = isAutopayConfigured()
  const base = appUrl()
  const warnings: string[] = []
  if (!configured) warnings.push('Brak AUTOPAY_SERVICE_ID lub AUTOPAY_HASH_KEY — płatności Autopay nie wystartują.')
  if (base.includes('localhost')) warnings.push('NEXT_PUBLIC_APP_URL wskazuje na localhost — Autopay nie dostarczy tam ITN.')
  if (base.startsWith('http://')) warnings.push('NEXT_PUBLIC_APP_URL nie używa https.')
  if (configured && process.env.NODE_ENV === 'production' && env.environment !== 'production') {
    warnings.push('Sklep działa produkcyjnie, ale Autopay wskazuje na środowisko testowe (AUTOPAY_ENV).')
  }
  return {
    id: 'autopay',
    name: 'Autopay',
    state: configured ? (warnings.length ? 'warn' : 'ok') : 'error',
    summary: configured ? `Skonfigurowany · środowisko ${env.environment === 'production' ? 'produkcyjne' : 'testowe'}` : 'Nieskonfigurowany',
    details: [
      { label: 'ServiceID', value: env.serviceId || '—' },
      { label: 'Bramka', value: env.baseUrl },
      { label: 'BLIK-0', value: yesNo(AUTOPAY_BLIK0_ENABLED) },
      { label: 'Karta w ramce', value: yesNo(AUTOPAY_CARD_IFRAME_ENABLED) },
      { label: 'Płatności cykliczne', value: yesNo(AUTOPAY_RECURRING_ENABLED) },
    ],
    warnings,
    testable: configured,
  }
}

function checkP24(): IntegrationCheck {
  const lacking = missing(['P24_MERCHANT_ID', 'P24_POS_ID', 'P24_API_KEY', 'P24_CRC_KEY'])
  const all = lacking.length === 0
  return {
    id: 'przelewy24',
    name: 'Przelewy24',
    state: all ? 'ok' : lacking.length === 4 ? 'off' : 'warn',
    summary: all
      ? `Skonfigurowany · ${process.env.NODE_ENV === 'production' ? 'secure.przelewy24.pl' : 'sandbox'}`
      : lacking.length === 4
        ? 'Nieskonfigurowany'
        : 'Częściowa konfiguracja',
    details: [{ label: 'Merchant ID', value: process.env.P24_MERCHANT_ID || '—' }],
    warnings: lacking.length && lacking.length < 4 ? [`Brak zmiennych: ${lacking.join(', ')}.`] : [],
  }
}

async function checkFurgonetka(): Promise<IntegrationCheck> {
  const lacking = missing(['FURGONETKA_CLIENT_ID', 'FURGONETKA_CLIENT_SECRET', 'FURGONETKA_REDIRECT_URI'])
  let tokenSource = 'brak'
  try {
    if (await redis.get('furgonetka:refresh_token')) tokenSource = 'zapisany po autoryzacji (Redis)'
    else if (has('FURGONETKA_REFRESH_TOKEN')) tokenSource = 'z .env (FURGONETKA_REFRESH_TOKEN)'
  } catch {
    tokenSource = has('FURGONETKA_REFRESH_TOKEN') ? 'z .env (FURGONETKA_REFRESH_TOKEN)' : 'nieznany (Redis niedostępny)'
  }
  const warnings = lacking.map((name) => `Brak zmiennej ${name}.`)
  if (tokenSource === 'brak') warnings.push('Brak tokenu — kliknij „Autoryzuj”, żeby połączyć konto Furgonetki.')
  if (!has('FURGONETKA_WEBHOOK_SECRET')) warnings.push('Brak FURGONETKA_WEBHOOK_SECRET — statusy przesyłek nie będą aktualizowane.')
  if (!has('NEXT_PUBLIC_FURGONETKA_MAP_API_KEY')) warnings.push('Brak klucza mapy punktów (NEXT_PUBLIC_FURGONETKA_MAP_API_KEY).')

  return {
    id: 'furgonetka',
    name: 'Furgonetka (wysyłka)',
    state: lacking.length ? 'error' : warnings.length ? 'warn' : 'ok',
    summary: lacking.length ? 'Nieskonfigurowana' : `Środowisko ${process.env.NODE_ENV === 'production' ? 'produkcyjne' : 'sandbox'}`,
    details: [
      { label: 'Token odświeżania', value: tokenSource },
      { label: 'Webhook', value: yesNo(has('FURGONETKA_WEBHOOK_SECRET')) },
      { label: 'Mapa punktów', value: yesNo(has('NEXT_PUBLIC_FURGONETKA_MAP_API_KEY')) },
    ],
    warnings,
    testable: !lacking.length && tokenSource !== 'brak',
  }
}

async function checkSmtp(): Promise<IntegrationCheck> {
  if (!smtpTransporter) {
    return {
      id: 'smtp',
      name: 'Poczta (SMTP)',
      state: 'off',
      summary: 'Nieskonfigurowana — maile nie są wysyłane',
      details: [],
      warnings: ['Ustaw SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS i SMTP_FROM.'],
    }
  }
  return {
    id: 'smtp',
    name: 'Poczta (SMTP)',
    state: 'ok',
    summary: 'Skonfigurowana',
    details: [
      { label: 'Serwer', value: `${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}` },
      { label: 'Nadawca', value: MAIL_FROM },
    ],
    warnings: [],
    testable: true,
  }
}

export async function getIntegrationChecks(): Promise<IntegrationCheck[]> {
  return Promise.all([
    checkSanity(),
    checkDatabase(),
    checkRedis(),
    Promise.resolve(checkClerk()),
    Promise.resolve(checkAutopay()),
    Promise.resolve(checkP24()),
    checkFurgonetka(),
    checkSmtp(),
  ])
}

/** Test połączenia na żądanie (wywołuje zewnętrzne API). */
export async function runIntegrationTest(id: string): Promise<string> {
  const withTimeout = async <T>(fn: (signal: AbortSignal) => Promise<T>) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      return await fn(controller.signal)
    } finally {
      clearTimeout(timer)
    }
  }

  switch (id) {
    case 'autopay': {
      const gateways = await withTimeout((signal) => fetchGateways(signal))
      return `Bramka odpowiada — dostępnych kanałów płatności: ${gateways.length}.`
    }
    case 'furgonetka': {
      try {
        await redis.del('furgonetka:services')
      } catch {
        /* test bez czyszczenia cache */
      }
      const services = await getAvailableServices()
      return `API odpowiada — usług na koncie: ${services.length} (${services.map((s) => s.code).slice(0, 8).join(', ')}).`
    }
    case 'smtp': {
      if (!smtpTransporter) throw new Error('SMTP nie jest skonfigurowany.')
      await smtpTransporter.verify()
      return 'Serwer SMTP przyjął logowanie.'
    }
    default:
      throw new Error('Ta integracja nie ma testu połączenia.')
  }
}
