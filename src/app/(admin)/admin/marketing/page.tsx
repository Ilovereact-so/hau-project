import type { Metadata } from 'next'
import { MailCheck, MailQuestion, MailX, UserPlus } from 'lucide-react'
import { getNewsletterStats } from '@/lib/admin/ordersQueries'
import {
  DEFAULT_NEWSLETTER_CONFIRM,
  DEFAULT_NEWSLETTER_WELCOME,
  NEWSLETTER_CONFIRM_KEY,
  NEWSLETTER_WELCOME_KEY,
  getEmailTemplate,
} from '@/lib/emailTemplates'
import { Card, CardHeader } from '@/components/admin/kit/Card'
import { Info } from 'lucide-react'
import { requireAdmin } from '@/lib/admin/guard'
import { SITE_URL } from '@/lib/site'
import { StatCard } from '@/components/admin/kit/StatCard'
import { ErrorBox } from '@/components/admin/kit/EmptyState'
import { NewsletterTemplateEditor } from '@/components/admin/marketing/NewsletterTemplateEditor'
import { SubscribersCard } from '@/components/admin/marketing/SubscribersCard'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Marketing' }

export default async function AdminMarketingPage() {
  await requireAdmin()
  const [statsResult, templateResult, confirmResult] = await Promise.allSettled([
    getNewsletterStats(),
    getEmailTemplate(NEWSLETTER_WELCOME_KEY),
    getEmailTemplate(NEWSLETTER_CONFIRM_KEY),
  ])
  const stats = statsResult.status === 'fulfilled' ? statsResult.value : null
  const template = templateResult.status === 'fulfilled' ? templateResult.value : DEFAULT_NEWSLETTER_WELCOME
  const confirmTemplate = confirmResult.status === 'fulfilled' ? confirmResult.value : DEFAULT_NEWSLETTER_CONFIRM

  return (
    <section className="flex flex-col gap-4 animate-fade-in">
      {!stats && (
        <ErrorBox>
          Nie udało się pobrać subskrybentów z bazy. Jeśli to pierwsze uruchomienie po aktualizacji — wykonaj migrację
          drizzle/0003_newsletter_double_optin.sql.
        </ErrorBox>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={MailCheck} label="Aktywni subskrybenci" value={String(stats?.active ?? 0)} delta="zapis potwierdzony mailem" tone="up" />
        <StatCard icon={MailQuestion} label="Czekają na potwierdzenie" value={String(stats?.pending ?? 0)} delta="nie kliknęli linku z maila" />
        <StatCard icon={UserPlus} label="Nowi (30 dni)" value={String(stats?.last30 ?? 0)} delta="zapisy z formularza w stopce" />
        <StatCard icon={MailX} label="Wypisani" value={String(stats?.inactive ?? 0)} delta="historia zgody zostaje" />
      </div>

      <Card className="flex flex-col">
        <CardHeader icon={Info} title="Jak działa newsletter" />
        <ol className="m-0 grid gap-1.5 px-8 pt-2 pb-4 text-xs leading-[1.6] text-text-2">
          <li>Klient wpisuje adres w stopce i zaznacza zgodę → dostaje mail <b className="text-text">„Potwierdź zapis”</b> (szablon niżej). Do tego czasu nie jest aktywnym subskrybentem.</li>
          <li>Po kliknięciu linku i przycisku „Potwierdzam zapis” subskrypcja staje się aktywna, a sklep wysyła <b className="text-text">mail powitalny z kodem</b> (kod musi istnieć w Marketing → Kody rabatowe).</li>
          <li>Każdy mail powitalny ma link wypisania; wypisanie ręczne jest w tabeli poniżej.</li>
          <li>
            Kolejne kampanie (nowości, promocje) wysyła się z narzędzia mailingowego (np. Brevo, MailerLite) — panel nie
            wysyła masowych maili. Listę aktywnych adresów pobierzesz przyciskiem „Eksport CSV” i zaimportujesz tam.
          </li>
        </ol>
      </Card>

      <NewsletterTemplateEditor
        templateKey="newsletter_confirm"
        title="1. Mail „Potwierdź zapis”"
        description={
          <>
            Wysyłany od razu po zapisie. Musi zawierać <code className="font-mono">{'{{confirmUrl}}'}</code> (link potwierdzający).
            Dostępne też <code className="font-mono">{'{{email}}'}</code>, <code className="font-mono">{'{{shopUrl}}'}</code> i{' '}
            <code className="font-mono">{'{{logoUrl}}'}</code> (logo HAU w PNG).
          </>
        }
        initial={confirmTemplate}
        defaults={{ subject: DEFAULT_NEWSLETTER_CONFIRM.subject, html: DEFAULT_NEWSLETTER_CONFIRM.html }}
        shopUrl={SITE_URL}
      />

      <NewsletterTemplateEditor
        templateKey="newsletter_welcome"
        title="2. Mail powitalny z kodem"
        description={
          <>
            Wysyłany po potwierdzeniu zapisu. <code className="font-mono">{'{{email}}'}</code> — adres,{' '}
            <code className="font-mono">{'{{shopUrl}}'}</code> — sklep, <code className="font-mono">{'{{unsubscribeUrl}}'}</code> — link
            wypisania (dodaj go w stopce maila), <code className="font-mono">{'{{logoUrl}}'}</code> — logo HAU w PNG.
            Zapisany szablon ma pierwszeństwo przed domyślnym — po zmianie wyglądu domyślnego kliknij „Domyślny” i zapisz.
          </>
        }
        initial={template}
        defaults={{ subject: DEFAULT_NEWSLETTER_WELCOME.subject, html: DEFAULT_NEWSLETTER_WELCOME.html }}
        shopUrl={SITE_URL}
      />

      <SubscribersCard subscribers={stats?.recent ?? []} />
    </section>
  )
}
