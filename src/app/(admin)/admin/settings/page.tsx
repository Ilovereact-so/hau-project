import type { Metadata } from 'next'
import { appUrl, getIntegrationChecks } from '@/lib/admin/integrations'
import { requireAdmin } from '@/lib/admin/guard'
import { findEnvIssues } from '@/lib/env'
import { IntegrationsView } from '@/components/admin/settings/IntegrationsView'
import { DEFAULT_OAUTH_REDIRECT_URI, getSavedOAuthRedirectUri, getSenderAddress } from '@/lib/furgonetka'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Integracje' }

export default async function AdminSettingsPage() {
  await requireAdmin()
  const [checks, savedRedirect, sender] = await Promise.all([getIntegrationChecks(), getSavedOAuthRedirectUri(), getSenderAddress()])
  const base = appUrl() || 'https://twoj-sklep.pl'

  const endpoints = [
    { label: 'Autopay — adres ITN', value: `${base}/api/webhooks/autopay`, hint: 'Panel Autopay → konfiguracja serwisu → adres powiadomień.' },
    { label: 'Autopay — adres powrotu', value: `${base}/api/autopay/return`, hint: 'Panel Autopay → adres powrotu klienta.' },
    { label: 'Przelewy24 — urlStatus', value: `${base}/api/webhooks/przelewy24`, hint: 'Wysyłany automatycznie przy rejestracji transakcji.' },
    { label: 'Furgonetka — webhook statusów', value: `${base}/api/webhooks/furgonetka`, hint: 'Panel Furgonetki → API → powiadomienia (podpis HMAC).' },
    { label: 'Clerk — webhook użytkowników', value: `${base}/api/webhooks/clerk`, hint: 'Dashboard Clerk → Webhooks (user.created).' },
    { label: 'Sanity — webhook cen', value: `${base}/api/webhooks/sanity-prices`, hint: 'sanity.io/manage → API → Webhooks. Adres musi być PEŁNY (z https://), filtr _type == "product", projekcja {_id}, secret = SANITY_PRICE_WEBHOOK_SECRET.' },
    { label: 'Rejestr cen — zadanie cykliczne', value: `${base}/api/cron/price-history`, hint: 'Wywołuj co godzinę z nagłówkiem Authorization: Bearer $CRON_SECRET (GitHub Actions albo cron hostingu).' },
  ]

  return (
    <IntegrationsView
      checks={checks}
      endpoints={endpoints}
      envIssues={findEnvIssues()}
      isProduction={process.env.NODE_ENV === 'production'}
      furgonetkaRedirect={savedRedirect || DEFAULT_OAUTH_REDIRECT_URI}
      furgonetkaSender={sender}
    />
  )
}
