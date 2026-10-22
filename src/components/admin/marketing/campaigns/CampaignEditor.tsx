'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ArrowLeft, CalendarClock, CircleAlert, Copy, ImagePlus, Loader2, Monitor, Pause, Play, Save, Send, Smartphone, Square, TestTube2, Trash2, X,
} from 'lucide-react'
import type { AdminCampaign, CampaignProgress } from '@/lib/campaigns/campaigns.server'
import type { PickerProduct } from '@/lib/admin/homeLayout'
import {
  CAMPAIGN_LIMITS,
  CAMPAIGN_STATUS_LABELS,
  campaignProblems,
  estimateSendTime,
  normalizeCampaignContent,
  type CampaignContent,
} from '@/lib/campaigns/content'
import {
  adminCampaignAction,
  adminCampaignProgress,
  adminDuplicateCampaign,
  adminPreviewCampaign,
  adminSaveCampaign,
  adminSendTestCampaign,
  adminStartCampaign,
} from '@/actions/adminCampaigns'
import { uploadAdminImage } from '@/lib/adminImageUpload'
import { prepareImageForUpload } from '@/lib/imageUpload'
import { Badge } from '../../kit/Badge'
import { Button } from '../../kit/Button'
import { Card, CardHeader } from '../../kit/Card'
import { ErrorBox, NoticeBox } from '../../kit/EmptyState'
import { Modal } from '../../kit/Modal'
import { TextField } from '../../kit/TextField'
import { Toggle } from '../../kit/Toggle'
import { RichTextEditor, type RichTextEditorHandle } from '../../kit/RichTextEditor'
import { cn } from '../../kit/utils'
import { ProductListPicker } from '../ProductListPicker'

/*
 * Marketing → Kampanie → kampania. Lewa kolumna: treść maila z klocków
 * (nagłówek, zdjęcie, tekst, przycisk, produkty, kod rabatowy), prawa: podgląd
 * liczony przez serwer — dokładnie ten HTML, który dostaną odbiorcy.
 * Po starcie wysyłki edycja się blokuje, a karta pokazuje postęp.
 */

type Usage = { day: number; minute?: number; dailyLimit: number; ratePerMinute: number }

const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Warsaw' }).format(new Date(value))
    : '—'

/** `datetime-local` w strefie przeglądarki (domyślnie: jutro 10:00). */
function defaultScheduleValue() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(10, 0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function CampaignEditor({
  campaign,
  products,
  audience,
  usage,
  smtpConfigured,
  adminEmail,
}: {
  campaign: AdminCampaign
  products: PickerProduct[]
  audience: number
  usage: Usage
  smtpConfigured: boolean
  adminEmail: string
}) {
  const editable = campaign.status === 'draft' || campaign.status === 'scheduled'
  return editable ? (
    <DraftEditor campaign={campaign} products={products} audience={audience} usage={usage} smtpConfigured={smtpConfigured} adminEmail={adminEmail} />
  ) : (
    <SendingView campaign={campaign} usage={usage} />
  )
}

// ─── edycja szkicu ───────────────────────────────────────────────────────────

function DraftEditor({
  campaign,
  products,
  audience,
  usage,
  smtpConfigured,
  adminEmail,
}: {
  campaign: AdminCampaign
  products: PickerProduct[]
  audience: number
  usage: Usage
  smtpConfigured: boolean
  adminEmail: string
}) {
  const router = useRouter()
  const [name, setName] = useState(campaign.name)
  const [subject, setSubject] = useState(campaign.subject)
  const [preheader, setPreheader] = useState(campaign.preheader)
  const [content, setContent] = useState<CampaignContent>(campaign.content)
  const bodyRef = useRef<RichTextEditorHandle>(null)
  const [bodyVersion, setBodyVersion] = useState(0)
  const [savedVersion, setSavedVersion] = useState(() => JSON.stringify([campaign.name, campaign.subject, campaign.preheader, { ...campaign.content, body: null }]))
  const [bodyDirty, setBodyDirty] = useState(false)
  const [saving, startSaving] = useTransition()
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{ html: string; missingProducts: number; problems: string[] } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [testTo, setTestTo] = useState(adminEmail)
  const [testing, startTesting] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const set = (patch: Partial<CampaignContent>) => setContent((current) => ({ ...current, ...patch }))

  /** Bieżąca treść formularza (tekst prosto ze stanu edytora). */
  const currentInput = useCallback(
    () => ({ name, subject, preheader, content: { ...content, body: bodyRef.current?.getValue() ?? content.body } }),
    [name, subject, preheader, content],
  )

  const fieldsSnapshot = JSON.stringify([name, subject, preheader, { ...content, body: null }])
  const dirty = fieldsSnapshot !== savedVersion || bodyDirty
  // Problemy z ostatniego podglądu (serwer czyta też tekst z edytora); przed pierwszym — z pól formularza.
  const problems = preview?.problems ?? campaignProblems({ name, subject, preheader, content })

  // Podgląd liczony przez serwer (te same funkcje co wysyłka), z opóźnieniem po zmianach.
  const previewSeq = useRef(0)
  useEffect(() => {
    const seq = ++previewSeq.current
    setPreviewLoading(true)
    const timer = setTimeout(async () => {
      const result = await adminPreviewCampaign(currentInput())
      if (seq !== previewSeq.current) return
      setPreviewLoading(false)
      if (result.ok) setPreview({ html: result.data.html, missingProducts: result.data.missingProducts, problems: result.data.problems })
      else setError(result.error)
    }, 700)
    return () => clearTimeout(timer)
  }, [fieldsSnapshot, bodyVersion, currentInput])

  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const save = (silent = false) =>
    new Promise<boolean>((resolve) =>
      startSaving(async () => {
        setError('')
        const result = await adminSaveCampaign(campaign.id, currentInput())
        if (!result.ok) {
          setError(result.error)
          return resolve(false)
        }
        setName(result.data.name)
        setContent((current) => ({ ...result.data.content, body: current.body }))
        setSavedVersion(JSON.stringify([result.data.name, result.data.subject, result.data.preheader, { ...result.data.content, body: null }]))
        setBodyDirty(false)
        if (!silent) toast.success('Kampania zapisana')
        resolve(true)
      }),
    )

  const sendTest = () =>
    startTesting(async () => {
      const result = await adminSendTestCampaign(currentInput(), testTo)
      if (!result.ok) return void toast.error(result.error)
      toast.success(`Mail testowy wysłany na ${testTo}`)
    })

  const pickImage = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const prepared = await prepareImageForUpload(file)
      const result = await uploadAdminImage<{ assetId: string; url: string }>({ target: 'campaign', id: campaign.id, file: prepared })
      if (!result.ok) return void setError(result.error)
      set({ image: { assetId: result.data.assetId, url: result.data.url, alt: content.image?.alt ?? '' } })
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const duplicate = async () => {
    const result = await adminDuplicateCampaign(campaign.id)
    if (!result.ok) return void toast.error(result.error)
    router.push(`/admin/campaigns/${result.data}`)
  }

  const unschedule = async () => {
    const result = await adminCampaignAction(campaign.id, 'unschedule')
    if (!result.ok) return void toast.error(result.error)
    toast.success('Wysyłka odwołana — kampania wróciła do szkiców')
    router.refresh()
  }

  const status = CAMPAIGN_STATUS_LABELS[campaign.status]

  return (
    <section className="flex flex-col gap-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/campaigns" className="inline-flex items-center gap-1 text-xs font-medium text-text-2 hover:text-text">
          <ArrowLeft size={13} strokeWidth={1.5} /> Kampanie
        </Link>
        <Badge tone={status.tone}>{status.label}</Badge>
        {campaign.lastError && <span className="text-xs text-danger">{campaign.lastError}</span>}
        <span className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => void duplicate()}>
            <Copy size={14} strokeWidth={1.5} />
            Kopiuj
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void save()} disabled={saving || !dirty}>
            <Save size={14} strokeWidth={1.5} />
            {saving ? 'Zapisuję…' : dirty ? 'Zapisz szkic' : 'Zapisano'}
          </Button>
          <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={!smtpConfigured || uploading}>
            <Send size={14} strokeWidth={1.5} />
            Wyślij…
          </Button>
        </span>
      </div>

      {campaign.status === 'scheduled' && (
        <NoticeBox className="flex flex-wrap items-center gap-3 border-purple/30 bg-purple/5">
          <CalendarClock size={15} strokeWidth={1.5} className="text-purple" />
          <span>
            Zaplanowana na <b className="text-text">{dateTime(campaign.scheduledAt)}</b>. Zmiany w treści zapisuj przyciskiem „Zapisz szkic” — wyjdzie
            wersja zapisana w chwili wysyłki.
          </span>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void unschedule()}>
            <X size={14} strokeWidth={1.5} />
            Odwołaj wysyłkę
          </Button>
        </NoticeBox>
      )}
      {!smtpConfigured && <ErrorBox>Wysyłka maili nie jest skonfigurowana (SMTP_HOST w .env) — można przygotować treść, ale nie wysłać.</ErrorBox>}
      {error && <ErrorBox>{error}</ErrorBox>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,640px)]">
        {/* ── formularz ── */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="flex flex-col">
            <CardHeader title="Skrzynka odbiorcza" subtitle="To widzi subskrybent na liście maili, zanim go otworzy." />
            <div className="grid gap-3 px-4 pt-3 pb-4">
              <TextField
                label="Nazwa kampanii (tylko w panelu)"
                value={name}
                maxLength={CAMPAIGN_LIMITS.name}
                onChange={(e) => setName(e.target.value)}
                hint="Trafia też do statystyk Google Analytics jako utm_campaign."
              />
              <TextField
                label="Temat maila"
                value={subject}
                maxLength={CAMPAIGN_LIMITS.subject}
                placeholder="np. Nowe szarpaki są już w sklepie 🐾"
                onChange={(e) => setSubject(e.target.value)}
                hint={`${subject.length}/${CAMPAIGN_LIMITS.subject} — najlepiej do ~50 znaków, wtedy mieści się w całości na telefonie.`}
              />
              <TextField
                label="Tekst podglądu (po temacie)"
                value={preheader}
                maxLength={CAMPAIGN_LIMITS.preheader}
                placeholder="np. Sprawdź, co przygotowałyśmy na jesienne spacery"
                onChange={(e) => setPreheader(e.target.value)}
                hint="Szary tekst obok tematu w Gmailu i na telefonie. Puste = nagłówek maila."
              />
            </div>
          </Card>

          <Card className="flex flex-col">
            <CardHeader title="Treść maila" subtitle="Klocki układają się w tej kolejności: zdjęcie, nagłówek, tekst, kod, przycisk, produkty. Napis w nagłówku stoi obok logo, z prawej." />
            <div className="grid gap-3 px-4 pt-3 pb-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <TextField
                  label="Napis obok logo"
                  value={content.eyebrow}
                  maxLength={CAMPAIGN_LIMITS.eyebrow}
                  placeholder="Newsletter HAU"
                  onChange={(e) => set({ eyebrow: e.target.value })}
                />
                <TextField
                  label="Nagłówek"
                  value={content.heading}
                  maxLength={CAMPAIGN_LIMITS.heading}
                  placeholder="np. Jesień na spacerach bez przemoczonych łap"
                  onChange={(e) => set({ heading: e.target.value })}
                />
              </div>

              {/* zdjęcie */}
              <div className="flex flex-wrap items-start gap-3 rounded-xs border border-border bg-surface px-3 py-3">
                <div className="grid h-[96px] w-[160px] shrink-0 place-items-center overflow-hidden rounded-xs border border-dashed border-border-strong bg-bg">
                  {content.image?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- podgląd z CDN Sanity
                    <img src={`${content.image.url}?w=320&h=192&fit=crop&auto=format`} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="px-2 text-center text-[11px] text-text-2">{content.image ? 'Zdjęcie zapisane' : 'Bez zdjęcia'}</span>
                  )}
                </div>
                <div className="flex min-w-[200px] flex-1 flex-col gap-2">
                  <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => void pickImage(e.target.files?.[0])} />
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="secondary" disabled={uploading} onClick={() => fileInput.current?.click()}>
                      {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} strokeWidth={1.5} />}
                      {uploading ? 'Wysyłam…' : content.image ? 'Zmień zdjęcie' : 'Dodaj zdjęcie główne'}
                    </Button>
                    {content.image && (
                      <Button size="sm" variant="ghost" onClick={() => set({ image: null })}>
                        <Trash2 size={14} strokeWidth={1.5} />
                        Usuń
                      </Button>
                    )}
                  </div>
                  {content.image ? (
                    <TextField
                      label="Opis zdjęcia (widać go, gdy skrzynka blokuje obrazki)"
                      value={content.image.alt}
                      maxLength={CAMPAIGN_LIMITS.alt}
                      placeholder="np. Pies w szelkach na jesiennym spacerze"
                      onChange={(e) => set({ image: content.image ? { ...content.image, alt: e.target.value } : null })}
                    />
                  ) : (
                    <span className="text-[11px] text-text-2">Poziome, min. 1000 px szerokości. Klik w zdjęcie prowadzi tam, gdzie przycisk.</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-2">Tekst</span>
                <RichTextEditor
                  ref={bodyRef}
                  initialValue={campaign.content.body}
                  minHeight={180}
                  placeholder="Napisz, co nowego. „## ” tworzy śródtytuł, „- ” listę, Ctrl+K — link."
                  onEdit={() => {
                    setBodyDirty(true)
                    setBodyVersion((v) => v + 1)
                  }}
                />
              </div>

              {/* przycisk */}
              <div className="grid gap-2 rounded-xs border border-border bg-surface px-3 py-3">
                <label className="flex items-center gap-2 text-xs font-medium text-text-2">
                  <Toggle
                    checked={Boolean(content.button)}
                    onChange={() => set({ button: content.button ? null : { label: 'Zobacz w sklepie', url: '/' } })}
                    label="Przycisk"
                  />
                  Przycisk pod tekstem
                </label>
                {content.button && (
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <TextField
                      label="Napis"
                      value={content.button.label}
                      maxLength={CAMPAIGN_LIMITS.buttonLabel}
                      onChange={(e) => set({ button: { ...content.button!, label: e.target.value } })}
                    />
                    <TextField
                      label="Adres"
                      value={content.button.url}
                      placeholder="/kolekcje/jesien albo https://…"
                      onChange={(e) => set({ button: { ...content.button!, url: e.target.value } })}
                      hint="Adres w sklepie zaczynaj od „/” (np. /category/zabawki) — dostanie znaczniki UTM do Analytics."
                    />
                  </div>
                )}
              </div>

              {/* kod */}
              <div className="grid gap-2 rounded-xs border border-border bg-surface px-3 py-3">
                <label className="flex items-center gap-2 text-xs font-medium text-text-2">
                  <Toggle checked={Boolean(content.code)} onChange={() => set({ code: content.code ? null : { code: '', caption: 'Wpisz go w koszyku przy zamówieniu.' } })} label="Kod rabatowy" />
                  Kod rabatowy w mailu
                </label>
                {content.code && (
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <TextField
                      label="Kod"
                      value={content.code.code}
                      maxLength={CAMPAIGN_LIMITS.code}
                      className="font-mono uppercase"
                      onChange={(e) => set({ code: { ...content.code!, code: e.target.value.toUpperCase().replace(/\s+/g, '') } })}
                      hint={
                        <>
                          Kod musi istnieć w <Link href="/admin/discounts" className="underline">Kodach rabatowych</Link>.
                        </>
                      }
                    />
                    <TextField
                      label="Opis pod kodem"
                      value={content.code.caption}
                      maxLength={CAMPAIGN_LIMITS.codeCaption}
                      placeholder="np. −15% na cały koszyk do niedzieli"
                      onChange={(e) => set({ code: { ...content.code!, caption: e.target.value } })}
                    />
                  </div>
                )}
              </div>

              {/* produkty */}
              <div className="grid gap-2 rounded-xs border border-border bg-surface px-3 py-3">
                <TextField
                  label="Nagłówek nad produktami"
                  value={content.productsTitle}
                  maxLength={CAMPAIGN_LIMITS.productsTitle}
                  placeholder="Polecamy"
                  onChange={(e) => set({ productsTitle: e.target.value })}
                />
                <ProductListPicker
                  label={`Produkty (do ${CAMPAIGN_LIMITS.products})`}
                  hint="Zdjęcie, nazwa i aktualna cena ze sklepu (bez przekreśleń — obniżkę ogłasza się z informacją Omnibus, dlatego w mailu jej nie pokazujemy)."
                  ids={content.productIds}
                  products={products.filter((p) => p.status !== 'draft')}
                  sortable
                  onChange={(productIds) => set({ productIds: productIds.slice(0, CAMPAIGN_LIMITS.products) })}
                />
              </div>
            </div>
          </Card>

          <Card className="flex flex-col">
            <CardHeader icon={TestTube2} title="Mail testowy" subtitle="Wyślij do siebie i sprawdź na telefonie i w komputerze, zanim pójdzie do wszystkich." />
            <div className="flex flex-wrap items-end gap-2 px-4 pt-3 pb-4">
              <div className="min-w-[240px] flex-1">
                <TextField label="Adres" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="ty@example.com" />
              </div>
              <Button size="sm" variant="secondary" onClick={sendTest} disabled={testing || !smtpConfigured || !testTo.trim()}>
                <Send size={14} strokeWidth={1.5} />
                {testing ? 'Wysyłam…' : 'Wyślij test'}
              </Button>
            </div>
          </Card>
        </div>

        {/* ── podgląd ── */}
        <div className="min-w-0">
          <div className="sticky top-2 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-text">Podgląd</span>
              {previewLoading && <Loader2 size={13} className="animate-spin text-text-2" />}
              <span className="ml-auto flex gap-1">
                <Button size="sm" variant={device === 'desktop' ? 'secondary' : 'ghost'} onClick={() => setDevice('desktop')}>
                  <Monitor size={14} strokeWidth={1.5} /> Komputer
                </Button>
                <Button size="sm" variant={device === 'mobile' ? 'secondary' : 'ghost'} onClick={() => setDevice('mobile')}>
                  <Smartphone size={14} strokeWidth={1.5} /> Telefon
                </Button>
              </span>
            </div>
            <div className="rounded-xs border border-border bg-surface px-3 py-2 text-xs">
              <p className="m-0 truncate font-semibold text-text">{subject || <span className="text-danger">bez tematu</span>}</p>
              <p className="m-0 truncate text-text-2">{preheader || content.heading || '—'}</p>
            </div>
            <div className="flex justify-center overflow-hidden rounded-xs border border-border bg-[#f5f5f3]">
              <iframe
                title="Podgląd maila"
                srcDoc={preview?.html ?? ''}
                sandbox=""
                className={cn('h-[78vh] border-0 bg-[#f5f5f3] transition-[width] duration-200', device === 'mobile' ? 'w-[390px]' : 'w-full')}
              />
            </div>
            {(problems.length > 0 || (preview?.missingProducts ?? 0) > 0) && (
              <NoticeBox className="border-danger/30 bg-danger/5">
                {problems.map((p) => (
                  <p key={p} className="m-0 flex items-start gap-1.5 text-danger">
                    <CircleAlert size={13} strokeWidth={1.5} className="mt-0.5 shrink-0" /> {p}
                  </p>
                ))}
                {(preview?.missingProducts ?? 0) > 0 && (
                  <p className="m-0 text-danger">{preview!.missingProducts} z wybranych produktów nie jest opublikowanych — nie pojawią się w mailu.</p>
                )}
              </NoticeBox>
            )}
          </div>
        </div>
      </div>

      {confirmOpen && (
        <SendModal
          campaignId={campaign.id}
          audience={audience}
          usage={usage}
          problems={problems}
          missingProducts={preview?.missingProducts ?? 0}
          getInput={currentInput}
          onClose={() => setConfirmOpen(false)}
          onStarted={() => {
            setSavedVersion(fieldsSnapshot)
            setBodyDirty(false)
            setConfirmOpen(false)
            router.refresh()
          }}
        />
      )}
    </section>
  )
}

function SendModal({
  campaignId,
  audience,
  usage,
  problems,
  missingProducts,
  getInput,
  onClose,
  onStarted,
}: {
  campaignId: string
  audience: number
  usage: Usage
  problems: string[]
  missingProducts: number
  getInput: () => unknown
  onClose: () => void
  onStarted: () => void
}) {
  const [mode, setMode] = useState<'now' | 'later'>('now')
  const [when, setWhen] = useState(defaultScheduleValue)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const blocked = problems.length > 0 || missingProducts > 0 || audience === 0

  const start = () =>
    startTransition(async () => {
      setError('')
      const scheduledAt = mode === 'later' ? new Date(when).toISOString() : null
      if (mode === 'later' && (!when || Number.isNaN(new Date(when).getTime()))) return setError('Wybierz datę i godzinę.')
      const result = await adminStartCampaign(campaignId, getInput() as never, scheduledAt)
      if (!result.ok) return setError(result.error)
      toast.success(result.data.status === 'scheduled' ? `Zaplanowano na ${dateTime(result.data.scheduledAt)}` : `Wysyłka ruszyła — ${result.data.total} odbiorców`)
      onStarted()
    })

  return (
    <Modal
      title="Wyślij kampanię"
      subtitle={`Do ${audience} ${audience === 1 ? 'subskrybenta' : 'subskrybentów'} z potwierdzonym zapisem. Wysłanego maila nie da się cofnąć.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anuluj
          </Button>
          <Button onClick={start} disabled={pending || blocked}>
            <Send size={14} strokeWidth={1.5} />
            {pending ? 'Uruchamiam…' : mode === 'now' ? `Wyślij do ${audience}` : 'Zaplanuj'}
          </Button>
        </>
      }
    >
      <div className="grid gap-2">
        <label className="flex items-center gap-2 text-xs font-medium text-text">
          <input type="radio" checked={mode === 'now'} onChange={() => setMode('now')} className="accent-[var(--adm-primary,#ec3013)]" />
          Wyślij teraz
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-text">
          <input type="radio" checked={mode === 'later'} onChange={() => setMode('later')} className="accent-[var(--adm-primary,#ec3013)]" />
          Zaplanuj na później
        </label>
        {mode === 'later' && (
          <TextField
            label="Data i godzina"
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            hint="Wysyłka ruszy przy pierwszym uruchomieniu zadania cyklicznego po tej godzinie (albo gdy otworzysz panel kampanii)."
          />
        )}
      </div>
      <NoticeBox>
        Szacowany czas wysyłki: <b className="text-text">{estimateSendTime(audience, usage.ratePerMinute, usage.dailyLimit)}</b> (do {usage.ratePerMinute} maili na
        minutę, {usage.dailyLimit} na dobę; dziś wyszło już {usage.day}). Kampanię można wstrzymać w każdej chwili.
      </NoticeBox>
      {audience === 0 && <ErrorBox>Nie ma subskrybentów z potwierdzonym zapisem — nie ma do kogo wysłać.</ErrorBox>}
      {(problems.length > 0 || missingProducts > 0) && (
        <ErrorBox>
          {[...problems, ...(missingProducts ? [`${missingProducts} produkt(y) nie są opublikowane — usuń je z listy.`] : [])].join(' ')}
        </ErrorBox>
      )}
      {error && <ErrorBox>{error}</ErrorBox>}
    </Modal>
  )
}

// ─── wysyłka w toku / zakończona ─────────────────────────────────────────────

function SendingView({ campaign: initial, usage: initialUsage }: { campaign: AdminCampaign; usage: Usage }) {
  const router = useRouter()
  const [campaign, setCampaign] = useState(initial)
  const [usage, setUsage] = useState<Usage>(initialUsage)
  const [failures, setFailures] = useState<CampaignProgress['failures']>([])
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<string>('')

  // Postęp + kolejna partia, dopóki trwa wysyłka (panel „napędza” wysyłkę).
  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const tick = async () => {
      const result = await adminCampaignProgress(campaign.id, campaign.status === 'sending')
      if (!active) return
      if (result.ok && result.data.campaign) {
        setCampaign(result.data.campaign)
        setUsage(result.data.usage)
        setFailures(result.data.failures)
        if (result.data.campaign.status === 'sending') timer = setTimeout(tick, 3_000)
      } else if (!result.ok) {
        timer = setTimeout(tick, 10_000)
      }
    }
    void tick()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
    // Pętla startuje od nowa tylko przy zmianie stanu (pauza / wznowienie / koniec).
  }, [campaign.id, campaign.status])

  // Podgląd wysłanej treści.
  const input = useMemo(
    () => ({ name: campaign.name, subject: campaign.subject, preheader: campaign.preheader, content: normalizeCampaignContent(campaign.content) }),
    [campaign.name, campaign.subject, campaign.preheader, campaign.content],
  )
  useEffect(() => {
    let active = true
    void adminPreviewCampaign(input).then((result) => {
      if (active && result.ok) setPreview(result.data.html)
    })
    return () => {
      active = false
    }
  }, [input])

  const act = async (action: 'pause' | 'resume' | 'cancel') => {
    if (action === 'cancel' && !window.confirm('Zatrzymać kampanię na stałe? Osoby, do których mail jeszcze nie wyszedł, już go nie dostaną.')) return
    setBusy(true)
    const result = await adminCampaignAction(campaign.id, action)
    setBusy(false)
    if (!result.ok) return void toast.error(result.error)
    setCampaign((current) => ({ ...current, status: action === 'pause' ? 'paused' : action === 'resume' ? 'sending' : 'cancelled' }))
    router.refresh()
  }

  const duplicate = async () => {
    const result = await adminDuplicateCampaign(campaign.id)
    if (!result.ok) return void toast.error(result.error)
    router.push(`/admin/campaigns/${result.data}`)
  }

  const status = CAMPAIGN_STATUS_LABELS[campaign.status]
  const done = campaign.sent + campaign.failed + campaign.skipped
  const percent = campaign.total ? Math.min(100, Math.round((done / campaign.total) * 100)) : 0
  const remaining = Math.max(0, campaign.pending)

  return (
    <section className="flex flex-col gap-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/campaigns" className="inline-flex items-center gap-1 text-xs font-medium text-text-2 hover:text-text">
          <ArrowLeft size={13} strokeWidth={1.5} /> Kampanie
        </Link>
        <Badge tone={status.tone}>{status.label}</Badge>
        <span className="ml-auto flex flex-wrap gap-2">
          {campaign.status === 'sending' && (
            <Button size="sm" variant="secondary" onClick={() => void act('pause')} disabled={busy}>
              <Pause size={14} strokeWidth={1.5} /> Wstrzymaj
            </Button>
          )}
          {campaign.status === 'paused' && (
            <Button size="sm" onClick={() => void act('resume')} disabled={busy}>
              <Play size={14} strokeWidth={1.5} /> Wznów
            </Button>
          )}
          {(campaign.status === 'sending' || campaign.status === 'paused') && (
            <Button size="sm" variant="danger" onClick={() => void act('cancel')} disabled={busy}>
              <Square size={14} strokeWidth={1.5} /> Zatrzymaj na stałe
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => void duplicate()}>
            <Copy size={14} strokeWidth={1.5} /> Kopiuj jako nowy szkic
          </Button>
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,640px)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="flex flex-col">
            <CardHeader title={campaign.name} subtitle={campaign.subject} />
            <div className="grid gap-3 px-4 pt-3 pb-4">
              <div>
                <div className="mb-1.5 flex justify-between text-xs text-text-2">
                  <span>
                    Wysłano <b className="text-text">{campaign.sent}</b> z {campaign.total}
                  </span>
                  <span>{percent}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface">
                  <div
                    className={cn('h-full rounded-full transition-[width] duration-500', campaign.status === 'paused' ? 'bg-danger' : 'bg-success')}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
              <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
                <Stat label="Wysłane" value={campaign.sent} />
                <Stat label="Czeka" value={remaining} />
                <Stat label="Błędy" value={campaign.failed} danger={campaign.failed > 0} />
                <Stat label="Pominięte" value={campaign.skipped} hint="wypisali się w trakcie albo kampanię zatrzymano" />
              </dl>
              <dl className="m-0 grid gap-1 text-xs text-text-2">
                <div>Start: <b className="text-text">{dateTime(campaign.startedAt)}</b></div>
                {campaign.finishedAt && <div>Koniec: <b className="text-text">{dateTime(campaign.finishedAt)}</b></div>}
                {campaign.status === 'sending' && remaining > 0 && (
                  <div>
                    Zostało: {estimateSendTime(remaining, usage.ratePerMinute, Math.max(1, usage.dailyLimit))} · dziś wyszło {usage.day}/{usage.dailyLimit}
                  </div>
                )}
              </dl>
              {campaign.lastError && <NoticeBox className="border-danger/30 bg-danger/5 text-danger">{campaign.lastError}</NoticeBox>}
              {campaign.status === 'sending' && (
                <NoticeBox>Możesz zamknąć tę stronę — resztę wyśle zadanie cykliczne na serwerze. Otwarty panel przyspiesza wysyłkę.</NoticeBox>
              )}
              {failures.length > 0 && (
                <div className="grid gap-1">
                  <span className="text-xs font-medium text-text-2">Adresy z błędem</span>
                  <ul className="m-0 grid list-none gap-1 p-0 text-[11px]">
                    {failures.map((f) => (
                      <li key={f.email} className="truncate rounded-xs border border-border bg-surface px-2 py-1">
                        <b className="text-text">{f.email}</b> <span className="text-text-2">— {f.error ?? 'błąd'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        </div>
        <div className="min-w-0">
          <div className="overflow-hidden rounded-xs border border-border bg-[#f5f5f3]">
            <iframe title="Wysłana treść" srcDoc={preview} sandbox="" className="h-[78vh] w-full border-0" />
          </div>
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value, danger, hint }: { label: string; value: number; danger?: boolean; hint?: string }) {
  return (
    <div title={hint}>
      <dt className="text-text-2">{label}</dt>
      <dd className={cn('m-0 text-base font-semibold', danger ? 'text-danger' : 'text-text')}>{value}</dd>
    </div>
  )
}
