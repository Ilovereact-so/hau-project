import type { Metadata } from 'next'
import { appUrl, getIntegrationChecks } from '@/lib/admin/integrations'
import { requireAdmin } from '@/lib/admin/guard'
import { findEnvIssues } from '@/lib/env'
import { IntegrationsView } from '@/components/admin/settings/IntegrationsView'
import {
  DEFAULT_OAUTH_REDIRECT_URI,
  getPickupAddressId,
  getSavedOAuthRedirectUri,
  getWebhookSettings,
  listAddressBook,
  type FurgonetkaAddressEntry,
  type FurgonetkaWebhookSettings,
} from '@/lib/furgonetka'
import { errorMessage } from '@/lib/admin/guard'

/** Dane Furgonetki dla ustawień — brak połączenia nie może wywrócić strony. */
async function furgonetkaPanelData() {
  const [book, webhook, pickupId] = await Promise.all([
    listAddressBook().then(
      (entries): { entries: FurgonetkaAddressEntry[]; error: string | null } => ({ entries, error: null }),
      (err) => ({ entries: [], error: errorMessage(err, 'Nie udało się pobrać książki adresowej.') }),
    ),
    getWebhookSettings().catch((): FurgonetkaWebhookSettings | null => null),
    getPickupAddressId(),
  ])
  return { book, webhook, pickupId }
}

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Integracje' }

export default async function AdminSettingsPage() {
  await requireAdmin()
  const [checks, savedRedirect, furgonetka] = await Promise.all([getIntegrationChecks(), getSavedOAuthRedirectUri(), furgonetkaPanelData()])
  const base = appUrl() || 'https://twoj-sklep.pl'

  const endpoints = [
    { label: 'Autopay — adres ITN', value: `${base}/api/webhooks/autopay`, hint: 'Panel Autopay → konfiguracja serwisu → adres powiadomień.' },
    { label: 'Autopay — adres powrotu', value: `${base}/api/autopay/return`, hint: 'Panel Autopay → adres powrotu klienta.' },
    { label: 'Przelewy24 — urlStatus', value: `${base}/api/webhooks/przelewy24`, hint: 'Wysyłany automatycznie przy rejestracji transakcji.' },
    { label: 'Furgonetka — webhook statusów', value: `${base}/api/webhooks/furgonetka`, hint: 'Panel Furgonetki → Ustawienia → Powiadomienia → Webhook. Format: JSON (XML też działa), sól: dowolna — sklep pobiera ją z API Furgonetki (FURGONETKA_WEBHOOK_SECRET w .env niepotrzebny). Zaznacz wszystkie stany przesyłki.' },
    { label: 'Clerk — webhook użytkowników', value: `${base}/api/webhooks/clerk`, hint: 'Dashboard Clerk → Webhooks (user.created).' },
    { label: 'Sanity — webhook cen', value: `${base}/api/webhooks/sanity-prices`, hint: 'sanity.io/manage → API → Webhooks. Adres musi być PEŁNY (z https://), filtr _type == "product", projekcja {_id}, secret = SANITY_PRICE_WEBHOOK_SECRET.' },
    { label: 'Rejestr cen — zadanie cykliczne', value: `${base}/api/cron/price-history`, hint: 'Wywołuj co godzinę z nagłówkiem Authorization: Bearer $CRON_SECRET (GitHub Actions albo cron hostingu).' },
    { label: 'Nieopłacone zamówienia — zadanie cykliczne', value: `${base}/api/cron/unpaid-orders`, hint: 'Wywołuj co godzinę z nagłówkiem Authorization: Bearer $CRON_SECRET. Przypomnienia o płatności (po 1 h i 12 h przed terminem) oraz anulowanie po terminie (ORDER_PAYMENT_DEADLINE_HOURS, domyślnie 72 h).' },
    { label: 'Kampanie newslettera — zadanie cykliczne', value: `${base}/api/cron/newsletter-campaigns`, hint: 'Wywołuj co 5–10 minut z nagłówkiem Authorization: Bearer $CRON_SECRET. Uruchamia zaplanowane kampanie i wysyła kolejne partie, gdy panel kampanii jest zamknięty.' },
  ]

  return (
    <IntegrationsView
      checks={checks}
      endpoints={endpoints}
      envIssues={findEnvIssues()}
      isProduction={process.env.NODE_ENV === 'production'}
      furgonetkaRedirect={savedRedirect || DEFAULT_OAUTH_REDIRECT_URI}
      furgonetka={{ ...furgonetka, webhookUrl: `${base}/api/webhooks/furgonetka` }}
    />
  )
}
