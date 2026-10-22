'use client'

import { useRef, useState, useTransition } from 'react'
import toast from 'react-hot-toast'
import { ExternalLink, ImagePlus, Loader2, Save, Share2, Trash2 } from 'lucide-react'
import { adminSaveSocialLinks } from '@/actions/adminHome'
import { uploadAdminImage } from '@/lib/adminImageUpload'
import { prepareImageForUpload } from '@/lib/imageUpload'
import { ABOUT_LIMITS, DEFAULT_ABOUT, aboutParagraphs, type HomeAbout } from '@/lib/homeLayout'
import {
  SOCIAL_LABELS,
  SOCIAL_NETWORKS,
  hasSocialLinks,
  normalizeSocialUrl,
  type SocialLinks,
  type SocialNetwork,
} from '@/lib/shopSettings'
import { Button } from '../kit/Button'
import { Card, CardHeader } from '../kit/Card'
import { ErrorBox, NoticeBox } from '../kit/EmptyState'
import { TextAreaField, TextField } from '../kit/TextField'
import { Toggle } from '../kit/Toggle'

/*
 * Marketing → Strona główna → „O nas”: tekst sekcji, blok z pieskiem (zdjęcie,
 * imię, opis) i przełącznik linków social. Zapis razem z układem strony
 * („Zapisz” u góry). Linki do profili — osobna karta, zapis od razu.
 */

export function AboutEditor({
  value,
  onChange,
  onBusyChange,
  social,
}: {
  value: HomeAbout
  onChange: (next: HomeAbout) => void
  onBusyChange: (busy: boolean) => void
  social: SocialLinks
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const set = (patch: Partial<HomeAbout>) => onChange({ ...value, ...patch })
  const paragraphs = aboutParagraphs(value.text)

  const pickImage = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setUploading(true)
    onBusyChange(true)
    try {
      const prepared = await prepareImageForUpload(file)
      const result = await uploadAdminImage<{ assetId: string; url: string }>({
        target: 'home',
        id: 'homeLayout',
        file: prepared,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      set({ dogImage: { assetId: result.data.assetId, url: result.data.url, alt: value.dogImage?.alt ?? '' } })
      toast.success('Zdjęcie wgrane — kliknij „Zapisz”, żeby pokazać je na stronie')
    } finally {
      setUploading(false)
      onBusyChange(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <fieldset className="grid gap-3 rounded-xs border border-border p-3">
        <legend className="px-1 text-xs font-semibold text-text">Tekst o sklepie</legend>
        <TextField
          label="Duży napis na zdjęciu"
          value={value.heading}
          maxLength={ABOUT_LIMITS.heading}
          placeholder={DEFAULT_ABOUT.heading}
          onChange={(event) => set({ heading: event.target.value })}
        />
        <TextAreaField
          label="Tekst"
          rows={9}
          value={value.text}
          maxLength={ABOUT_LIMITS.text}
          onChange={(event) => set({ text: event.target.value })}
          hint={
            <>
              Nowy akapit = pusta linia. Tekst w <code>*gwiazdkach*</code> będzie wyróżniony kolorem (np. pierwsze zdanie akapitu).
              {' '}Akapitów: {paragraphs.length}.
            </>
          }
        />
        <Button size="sm" variant="ghost" className="w-fit" onClick={() => set({ heading: DEFAULT_ABOUT.heading, text: DEFAULT_ABOUT.text })}>
          Przywróć dotychczasowy tekst
        </Button>
      </fieldset>

      <fieldset className="grid gap-3 rounded-xs border border-border p-3">
        <legend className="px-1 text-xs font-semibold text-text">Piesek sklepu</legend>
        <div className="flex flex-wrap items-start gap-4">
          <div className="grid size-[148px] shrink-0 place-items-center overflow-hidden rounded-[28px] border border-dashed border-border-strong bg-bg">
            {value.dogImage?.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- podgląd z CDN Sanity w panelu
              <img src={`${value.dogImage.url}?w=300&h=300&fit=crop&auto=format`} alt={value.dogImage.alt || 'Zdjęcie pieska'} className="size-full object-cover" />
            ) : value.dogImage ? (
              <span className="px-3 text-center text-[11px] text-text-2">Zdjęcie zapisane</span>
            ) : (
              <span className="px-3 text-center text-[11px] text-text-2">Brak zdjęcia — blok z pieskiem jest ukryty</span>
            )}
          </div>
          <div className="flex min-w-[200px] flex-1 flex-col gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void pickImage(event.target.files?.[0])}
            />
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" disabled={uploading} onClick={() => fileInput.current?.click()}>
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} strokeWidth={1.5} />}
                {uploading ? 'Wysyłam…' : value.dogImage ? 'Zmień zdjęcie' : 'Dodaj zdjęcie'}
              </Button>
              {value.dogImage && (
                <Button size="sm" variant="ghost" disabled={uploading} onClick={() => set({ dogImage: null })}>
                  <Trash2 size={14} strokeWidth={1.5} />
                  Usuń zdjęcie
                </Button>
              )}
            </div>
            <span className="text-[11px] text-text-2">Najlepiej kwadratowe (sklep przytnie je do kwadratu z zaokrąglonymi rogami), min. 700 × 700 px.</span>
            {value.dogImage && (
              <TextField
                label="Opis zdjęcia (dla niewidomych i Google)"
                value={value.dogImage.alt}
                maxLength={ABOUT_LIMITS.alt}
                placeholder={value.dogName ? `${value.dogName} — chart w ogrodzie` : 'np. Fiona — chart w ogrodzie'}
                onChange={(event) => set({ dogImage: value.dogImage ? { ...value.dogImage, alt: event.target.value } : null })}
              />
            )}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Nagłówek"
            value={value.dogTitle}
            maxLength={ABOUT_LIMITS.dogTitle}
            placeholder={DEFAULT_ABOUT.dogTitle}
            onChange={(event) => set({ dogTitle: event.target.value })}
          />
          <TextField
            label="Imię"
            value={value.dogName}
            maxLength={ABOUT_LIMITS.dogName}
            placeholder="np. Fiona"
            onChange={(event) => set({ dogName: event.target.value })}
          />
        </div>
        <TextAreaField
          label="Kilka słów o piesku"
          rows={4}
          value={value.dogText}
          maxLength={ABOUT_LIMITS.dogText}
          onChange={(event) => set({ dogText: event.target.value })}
        />
      </fieldset>

      <fieldset className="grid gap-2 rounded-xs border border-border p-3">
        <legend className="px-1 text-xs font-semibold text-text">Media społecznościowe</legend>
        <label className="flex items-center gap-2 text-xs font-medium text-text-2">
          <Toggle checked={value.showSocial} onChange={() => set({ showSocial: !value.showSocial })} label="Pokaż linki pod tekstem" />
          Pokaż „Zaobserwuj nas” pod tekstem „O nas”
        </label>
        {!hasSocialLinks(social) && (
          <NoticeBox>Nie ma jeszcze linków do profili — wpisz je w karcie „Media społecznościowe” niżej.</NoticeBox>
        )}
      </fieldset>

      {error && <ErrorBox>{error}</ErrorBox>}
      <p className="m-0 text-[11px] text-text-2">Zmiany w „O nas” zapisuje przycisk „Zapisz” u góry (razem z układem strony).</p>
    </div>
  )
}

const PLACEHOLDERS: Record<SocialNetwork, string> = {
  facebook: 'https://www.facebook.com/hausklep',
  instagram: 'https://www.instagram.com/hausklep albo @hausklep',
  tiktok: 'https://www.tiktok.com/@hausklep albo @hausklep',
}

/** Linki do profili sklepu — stopka (każda strona) i „O nas” na stronie głównej. */
export function SocialLinksCard({ initial }: { initial: SocialLinks }) {
  const [values, setValues] = useState<Record<SocialNetwork, string>>(() => ({
    facebook: initial.facebook ?? '',
    instagram: initial.instagram ?? '',
    tiktok: initial.tiktok ?? '',
  }))
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const invalid = SOCIAL_NETWORKS.filter((network) => values[network].trim() && !normalizeSocialUrl(network, values[network]))

  const save = () =>
    startTransition(async () => {
      setError('')
      const result = await adminSaveSocialLinks(values)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setValues({
        facebook: result.data.facebook ?? '',
        instagram: result.data.instagram ?? '',
        tiktok: result.data.tiktok ?? '',
      })
      toast.success('Linki zapisane — pojawią się w stopce i w „O nas”')
    })

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={Share2}
        title="Media społecznościowe"
        subtitle="Ikony z linkami w stopce każdej strony i w sekcji „O nas”. Pusty link = ikona się nie pokazuje."
      />
      <div className="grid gap-3 px-4 pt-3 pb-4 md:grid-cols-3">
        {SOCIAL_NETWORKS.map((network) => (
          <div key={network} className="flex flex-col gap-1">
            <TextField
              label={SOCIAL_LABELS[network]}
              value={values[network]}
              placeholder={PLACEHOLDERS[network]}
              inputMode="url"
              error={invalid.includes(network) ? `To nie jest link do ${SOCIAL_LABELS[network]}a.` : undefined}
              onChange={(event) => setValues((current) => ({ ...current, [network]: event.target.value }))}
            />
            {normalizeSocialUrl(network, values[network]) && (
              <a
                href={normalizeSocialUrl(network, values[network])!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1 text-[11px] font-medium text-text-2 hover:text-text"
              >
                Sprawdź link <ExternalLink size={11} strokeWidth={1.5} />
              </a>
            )}
          </div>
        ))}
        <div className="flex items-center gap-3 md:col-span-3">
          <Button size="sm" onClick={save} disabled={pending || invalid.length > 0}>
            <Save size={14} strokeWidth={1.5} />
            {pending ? 'Zapisuję…' : 'Zapisz linki'}
          </Button>
          {error && <ErrorBox className="flex-1">{error}</ErrorBox>}
        </div>
      </div>
    </Card>
  )
}
