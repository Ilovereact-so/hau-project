'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  AlertTriangle, CheckCircle2, CircleDashed, CreditCard, Database, KeyRound, Link2, Mail, PlugZap,
  RefreshCw, Server, ShieldCheck, Truck, XCircle,
} from 'lucide-react'
import type { CheckState, IntegrationCheck } from '@/lib/admin/integrations'
import type { EnvIssue } from '@/lib/env'
import { adminTestIntegration } from '@/actions/adminIntegrations'
import { Badge, type BadgeTone } from '../kit/Badge'
import { Button, buttonClass } from '../kit/Button'
import { Card, CardHeader } from '../kit/Card'
import { CopyField } from '../kit/CopyField'
import { PillButton } from '../kit/Pill'
import { cn } from '../kit/utils'

const ICONS: Record<string, typeof Database> = {
  sanity: Database,
  mysql: Server,
  redis: Server,
  clerk: ShieldCheck,
  autopay: CreditCard,
  przelewy24: CreditCard,
  furgonetka: Truck,
  smtp: Mail,
}

const STATE: Record<CheckState, { label: string; tone: BadgeTone; icon: typeof CheckCircle2 }> = {
  ok: { label: 'Działa', tone: 'success', icon: CheckCircle2 },
  warn: { label: 'Do sprawdzenia', tone: 'primary', icon: AlertTriangle },
  error: { label: 'Błąd', tone: 'danger', icon: XCircle },
  off: { label: 'Wyłączone', tone: 'neutral', icon: CircleDashed },
}

export function IntegrationsView({
  checks,
  endpoints,
  envIssues,
  isProduction,
}: {
  checks: IntegrationCheck[]
  endpoints: Array<{ label: string; value: string; hint: string }>
  envIssues: EnvIssue[]
  isProduction: boolean
}) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const [testing, setTesting] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { ok: boolean; text: string }>>({})

  const test = async (id: string) => {
    setTesting(id)
    const result = await adminTestIntegration(id)
    setTesting(null)
    setResults((current) => ({ ...current, [id]: result.ok ? { ok: true, text: result.data } : { ok: false, text: result.error } }))
    if (result.ok) toast.success('Test zakończony powodzeniem')
    else toast.error('Test nie powiódł się')
  }

  const disconnectFurgonetka = async () => {
    if (!window.confirm('Usunąć zapisane tokeny Furgonetki? Nadawanie paczek przestanie działać do ponownej autoryzacji.')) return
    const res = await fetch('/api/furgonetka/disconnect', { method: 'POST' })
    if (res.ok) {
      toast.success('Tokeny usunięte — autoryzuj konto ponownie')
      router.refresh()
    } else {
      toast.error(`Nie udało się (HTTP ${res.status})`)
    }
  }

  const problems = checks.filter((check) => check.state === 'error' || check.state === 'warn').length
  const criticalEnv = envIssues.filter((issue) => issue.level === 'critical')

  return (
    <section className="flex flex-col gap-4 animate-fade-in">
      {envIssues.length > 0 && (
        <Card className="flex flex-col">
          <CardHeader
            icon={KeyRound}
            title="Brakująca konfiguracja (.env)"
            subtitle={
              criticalEnv.length
                ? `${criticalEnv.length} ${criticalEnv.length === 1 ? 'zmienna jest' : 'zmiennych jest'} niezbędna do sprzedaży — bez nich sklep nie przyjmie zamówienia.`
                : 'Wszystko, co niezbędne, jest ustawione. Poniższe zmienne wyłączają tylko pojedyncze funkcje.'
            }
          />
          <ul className="m-0 flex list-none flex-col gap-2 px-4 pt-3 pb-4">
            {envIssues.map((issue) => (
              <li
                key={issue.keys.join('|')}
                className="flex items-start gap-2.5 rounded-xs border border-border bg-surface-muted p-2.5 text-xs"
              >
                {issue.level === 'critical' ? (
                  <XCircle size={14} strokeWidth={1.5} className="mt-px shrink-0 text-danger" />
                ) : (
                  <AlertTriangle size={14} strokeWidth={1.5} className="mt-px shrink-0 text-primary" />
                )}
                <div className="min-w-0">
                  <p className="m-0 font-medium text-text">{issue.label}</p>
                  <p className="mt-0.5 mb-0 font-mono text-[11px] text-text-2">{issue.keys.join(' albo ')}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="flex flex-col">
        <CardHeader
          icon={PlugZap}
          title="Stan integracji"
          subtitle={
            problems
              ? `${problems} ${problems === 1 ? 'integracja wymaga' : 'integracje wymagają'} uwagi. Sekrety nie są wyświetlane — tylko informacja, czy są ustawione.`
              : 'Wszystkie połączenia działają. Sekrety nie są wyświetlane — tylko informacja, czy są ustawione.'
          }
          actions={
            <PillButton icon={RefreshCw} onClick={() => startRefresh(() => router.refresh())} disabled={refreshing}>
              {refreshing ? 'Sprawdzam…' : 'Sprawdź ponownie'}
            </PillButton>
          }
        />
        <div className="grid gap-3 px-4 pt-3 pb-4 md:grid-cols-2 xl:grid-cols-3">
          {checks.map((check) => {
            const Icon = ICONS[check.id] ?? PlugZap
            const state = STATE[check.state]
            const StateIcon = state.icon
            const result = results[check.id]
            return (
              <article key={check.id} className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3.5 shadow-1">
                <div className="flex items-start gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xs border border-border bg-surface-muted text-text-2">
                    <Icon size={16} strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="m-0 text-sm font-semibold tracking-tight text-text">{check.name}</h3>
                    <p className="mt-0.5 mb-0 text-[11px] text-text-2">{check.summary}</p>
                  </div>
                  <Badge tone={state.tone}>
                    <StateIcon size={11} strokeWidth={2} className="mr-1" />
                    {state.label}
                  </Badge>
                </div>

                {check.details.length > 0 && (
                  <dl className="m-0 flex flex-col gap-1 text-xs">
                    {check.details.map((detail) => (
                      <div key={detail.label} className="flex items-baseline justify-between gap-3">
                        <dt className="shrink-0 text-text-2">{detail.label}</dt>
                        <dd className="m-0 min-w-0 truncate text-right font-medium text-text" title={detail.value}>
                          {detail.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                {check.warnings.length > 0 && (
                  <ul className="m-0 flex list-none flex-col gap-1 rounded-xs border border-primary/25 bg-primary/5 p-2 text-[11px] text-text">
                    {check.warnings.map((warning) => (
                      <li key={warning} className="flex gap-1.5">
                        <AlertTriangle size={12} strokeWidth={1.5} className="mt-px shrink-0 text-primary" />
                        {warning}
                      </li>
                    ))}
                  </ul>
                )}

                {result && (
                  <p className={cn('m-0 rounded-xs px-2 py-1.5 text-[11px] font-medium', result.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger')}>
                    {result.text}
                  </p>
                )}

                <div className="mt-auto flex flex-wrap gap-2">
                  {check.testable && (
                    <Button size="sm" variant="secondary" disabled={testing !== null} onClick={() => void test(check.id)}>
                      <Link2 size={13} strokeWidth={1.5} />
                      {testing === check.id ? 'Testuję…' : 'Testuj połączenie'}
                    </Button>
                  )}
                  {check.id === 'furgonetka' && (
                    <>
                      {/* Zwykły <a>: trasa API przekierowuje na zewnętrzny serwer OAuth. */}
                      <a href="/api/furgonetka/connect" className={buttonClass('secondary', 'sm')}>
                        <KeyRound size={13} strokeWidth={1.5} />
                        Autoryzuj konto
                      </a>
                      <Button size="sm" variant="ghost" onClick={() => void disconnectFurgonetka()}>
                        Rozłącz
                      </Button>
                    </>
                  )}
                  {check.id === 'autopay' && !isProduction && (
                    <a href="/api/autopay/diagnostics" target="_blank" rel="noopener noreferrer" className={buttonClass('ghost', 'sm')}>
                      Diagnostyka (JSON)
                    </a>
                  )}
                  {check.id === 'sanity' && (
                    <a href="/studio" target="_blank" rel="noopener noreferrer" className={buttonClass('ghost', 'sm')}>
                      Otwórz Studio
                    </a>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </Card>

      <Card className="flex flex-col">
        <CardHeader
          icon={Link2}
          title="Adresy do wpisania u operatorów"
          subtitle="Webhooki i powroty z bramek — muszą wskazywać publiczny adres sklepu (NEXT_PUBLIC_APP_URL)."
        />
        <div className="grid gap-4 px-4 pt-3 pb-4 md:grid-cols-2">
          {endpoints.map((endpoint) => (
            <CopyField key={endpoint.label} label={endpoint.label} value={endpoint.value} hint={endpoint.hint} />
          ))}
        </div>
      </Card>
    </section>
  )
}
