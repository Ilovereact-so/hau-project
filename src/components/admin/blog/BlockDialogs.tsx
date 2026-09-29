'use client'

import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, FileVideo, ImageOff, Info, Lightbulb, Link2, Plus, Search, Sparkles, Upload, X } from 'lucide-react'
import {
  CALLOUT_TONES,
  CALLOUT_TONE_LABELS,
  GUIDE_ALT_MAX,
  GUIDE_CAPTION_MAX,
  PRODUCT_EMBED_MAX,
  normalizeHref,
  type CalloutTone,
} from '@/lib/guides/content'
import { parseVideoUrl } from '@/lib/video'
import { Badge } from '../kit/Badge'
import { Button, IconButton } from '../kit/Button'
import { ErrorBox, NoticeBox } from '../kit/EmptyState'
import { Modal } from '../kit/Modal'
import { FIELD_BASE, TextAreaField, TextField } from '../kit/TextField'
import { cn } from '../kit/utils'
import { imageUrlFromRef, type EditorGuideLink, type EditorProduct } from './shared'

/*
 * Okna edycji bloków artykułu (link, film, ramka, polecane produkty, zdjęcie).
 * Każde zwraca gotową wartość bloku przez `onSubmit` — edytor wstawia ją
 * albo podmienia w istniejącym bloku.
 */

const formatPrice = (value: number | null) =>
  value === null ? '' : new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
}

// ─── link ────────────────────────────────────────────────────────────────────

export function LinkDialog({
  initialHref,
  products,
  guides,
  onSubmit,
  onRemove,
  onClose,
}: {
  initialHref?: string
  products: EditorProduct[]
  guides: EditorGuideLink[]
  onSubmit: (href: string) => void
  onRemove?: () => void
  onClose: () => void
}) {
  const [href, setHref] = useState(initialHref ?? '')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const needle = normalizeText(search.trim())
  const results = useMemo(() => {
    if (needle.length < 2) return []
    const productHits = products
      .filter((product) => product.slug && normalizeText(`${product.title} ${product.sku ?? ''}`).includes(needle))
      .slice(0, 6)
      .map((product) => ({ key: `p-${product.id}`, label: product.title, kind: 'Produkt', href: `/product/${product.slug}`, draft: product.status === 'draft' }))
    const guideHits = guides
      .filter((guide) => guide.slug && normalizeText(guide.title).includes(needle))
      .slice(0, 4)
      .map((guide) => ({ key: `g-${guide.id}`, label: guide.title, kind: 'Poradnik', href: `/poradniki/${guide.slug}`, draft: guide.status === 'draft' }))
    return [...productHits, ...guideHits]
  }, [needle, products, guides])

  const submit = () => {
    const normalized = normalizeHref(href)
    if (!normalized) {
      setError('Podaj pełny adres (https://…), ścieżkę sklepu (/product/…), e-mail (mailto:…) albo telefon (tel:…).')
      return
    }
    onSubmit(normalized)
  }

  return (
    <Modal
      title={initialHref ? 'Edytuj odnośnik' : 'Wstaw odnośnik'}
      subtitle="Linki do sklepu otwierają się w tej samej karcie, zewnętrzne — w nowej."
      onClose={onClose}
      as="form"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      footer={
        <>
          {onRemove && (
            <Button variant="danger" onClick={onRemove} className="mr-auto">
              Usuń link
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Anuluj
          </Button>
          <Button type="submit">{initialHref ? 'Zapisz' : 'Wstaw'}</Button>
        </>
      }
    >
      <TextField
        label="Adres"
        autoFocus
        value={href}
        placeholder="https://… albo /product/…"
        onChange={(event) => {
          setHref(event.target.value)
          setError('')
        }}
        error={error || undefined}
      />
      <div className="grid gap-2">
        <span className="text-xs font-medium text-text-2">…albo znajdź stronę sklepu</span>
        <div className={cn('flex h-10 items-center gap-2 px-3', FIELD_BASE)}>
          <Search size={14} strokeWidth={1.5} className="shrink-0 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nazwa produktu lub poradnika…"
            className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
            aria-label="Szukaj produktu lub poradnika"
          />
        </div>
        {needle.length >= 2 && (
          <ul className="m-0 grid max-h-56 list-none gap-1 overflow-auto rounded-xs border border-border bg-surface-muted p-1.5">
            {results.length ? (
              results.map((result) => (
                <li key={result.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setHref(result.href)
                      setError('')
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-xs px-2 py-1.5 text-left text-xs hover:bg-surface',
                      href === result.href && 'bg-surface ring-1 ring-primary/40'
                    )}
                  >
                    <Link2 size={13} strokeWidth={1.5} className="shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate text-text">{result.label}</span>
                    {result.draft && <Badge tone="primary">szkic</Badge>}
                    <Badge tone={result.kind === 'Produkt' ? 'info' : 'purple'}>{result.kind}</Badge>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-2 py-1 text-xs text-text-2">Nic nie pasuje do „{search.trim()}”.</li>
            )}
          </ul>
        )}
      </div>
    </Modal>
  )
}

// ─── film ────────────────────────────────────────────────────────────────────

export type VideoBlockValue = {
  provider: 'external' | 'file'
  url?: string
  file?: { _type: 'file'; asset: { _type: 'reference'; _ref: string } }
  caption?: string
}

export function VideoDialog({
  initial,
  onSubmit,
  onUploadFile,
  onClose,
}: {
  initial?: VideoBlockValue
  onSubmit: (value: VideoBlockValue) => void
  onUploadFile: (file: File) => Promise<{ ref: string } | { error: string }>
  onClose: () => void
}) {
  const [provider, setProvider] = useState<'external' | 'file'>(initial?.provider ?? 'external')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [fileRef, setFileRef] = useState(initial?.file?.asset._ref ?? '')
  const [fileName, setFileName] = useState('')
  const [caption, setCaption] = useState(initial?.caption ?? '')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const parsed = parseVideoUrl(url)

  const submit = () => {
    const text = caption.trim().slice(0, 200)
    if (provider === 'external') {
      if (!parsed.embedUrl) return setError('Wklej link do filmu z YouTube albo Vimeo (np. https://youtu.be/…).')
      onSubmit({ provider, url: url.trim(), ...(text && { caption: text }) })
    } else {
      if (!fileRef) return setError('Wgraj plik wideo.')
      onSubmit({ provider, file: { _type: 'file', asset: { _type: 'reference', _ref: fileRef } }, ...(text && { caption: text }) })
    }
  }

  const upload = async (file: File) => {
    setUploading(true)
    setError('')
    const result = await onUploadFile(file)
    setUploading(false)
    if ('error' in result) return setError(result.error)
    setFileRef(result.ref)
    setFileName(file.name)
  }

  return (
    <Modal
      title={initial ? 'Edytuj film' : 'Wstaw film'}
      subtitle="Film ładuje się dopiero po kliknięciu — strona pozostaje szybka."
      onClose={onClose}
      width="w-[min(560px,100%)]"
      as="form"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anuluj
          </Button>
          <Button type="submit" disabled={uploading}>
            {initial ? 'Zapisz' : 'Wstaw film'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 rounded-sm bg-surface-muted p-1">
        {(['external', 'file'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setProvider(value)
              setError('')
            }}
            className={cn(
              'h-8 rounded-xs text-xs font-medium transition-colors',
              provider === value ? 'bg-bg text-text shadow-pill' : 'text-text-2 hover:text-text'
            )}
          >
            {value === 'external' ? 'Link YouTube / Vimeo' : 'Plik wideo (do 11 MB)'}
          </button>
        ))}
      </div>

      {provider === 'external' ? (
        <>
          <TextField
            label="Link do filmu"
            autoFocus
            value={url}
            placeholder="https://www.youtube.com/watch?v=…"
            onChange={(event) => {
              setUrl(event.target.value)
              setError('')
            }}
          />
          {parsed.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={parsed.thumbnailUrl.replace('maxresdefault', 'hqdefault')} alt="" className="aspect-video w-full rounded-sm object-cover" />
          ) : url && parsed.provider === 'vimeo' ? (
            <NoticeBox>Film z Vimeo rozpoznany. Miniaturę pokażemy z okładki artykułu.</NoticeBox>
          ) : null}
        </>
      ) : (
        <div className="grid gap-2">
          <input
            ref={input}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void upload(file)
            }}
          />
          <Button variant="secondary" onClick={() => input.current?.click()} disabled={uploading}>
            {uploading ? 'Wgrywanie…' : fileRef ? 'Zmień plik' : 'Wybierz plik MP4 / WebM'}
            {!uploading && <Upload size={14} strokeWidth={1.5} />}
          </Button>
          {fileRef && (
            <p className="m-0 flex items-center gap-2 text-xs text-text-2">
              <FileVideo size={14} strokeWidth={1.5} />
              {fileName || 'Plik wgrany do Sanity'}
            </p>
          )}
          <NoticeBox>
            Wgrane pliki obciążają transfer projektu Sanity. Dłuższe filmy wrzuć na YouTube i wklej link — działa szybciej i w lepszej jakości.
          </NoticeBox>
        </div>
      )}

      <TextField label="Podpis pod filmem (opcjonalny)" value={caption} maxLength={200} onChange={(event) => setCaption(event.target.value)} />
      {error && <ErrorBox>{error}</ErrorBox>}
    </Modal>
  )
}

// ─── ramka ───────────────────────────────────────────────────────────────────

export type CalloutBlockValue = { tone: CalloutTone; title?: string; text: string }

const TONE_ICONS: Record<CalloutTone, typeof Lightbulb> = { tip: Lightbulb, info: Info, warning: AlertTriangle, important: Sparkles }
const TONE_SWATCH: Record<CalloutTone, string> = {
  tip: 'bg-[#EEF7F5] text-[#1F5E54] border-[#BCDFDB]',
  info: 'bg-[#EEF3FB] text-[#274C85] border-[#CFDDF3]',
  warning: 'bg-[#FDF6E7] text-[#7A5410] border-[#F2DDAA]',
  important: 'bg-[#FCEFEC] text-[#8A2E1C] border-[#F3CCC3]',
}

export function CalloutDialog({
  initial,
  onSubmit,
  onClose,
}: {
  initial?: CalloutBlockValue
  onSubmit: (value: CalloutBlockValue) => void
  onClose: () => void
}) {
  const [tone, setTone] = useState<CalloutTone>(initial?.tone ?? 'tip')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [text, setText] = useState(initial?.text ?? '')
  const [error, setError] = useState('')

  return (
    <Modal
      title={initial ? 'Edytuj ramkę' : 'Wstaw ramkę'}
      subtitle="Wyróżnia wskazówkę, ostrzeżenie albo najważniejszą informację w tekście."
      onClose={onClose}
      width="w-[min(560px,100%)]"
      as="form"
      onSubmit={(event) => {
        event.preventDefault()
        if (!text.trim()) return setError('Wpisz treść ramki.')
        onSubmit({ tone, text: text.trim().slice(0, 1500), ...(title.trim() && { title: title.trim().slice(0, 120) }) })
      }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anuluj
          </Button>
          <Button type="submit">{initial ? 'Zapisz' : 'Wstaw ramkę'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Rodzaj ramki">
        {CALLOUT_TONES.map((value) => {
          const Icon = TONE_ICONS[value]
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={tone === value}
              onClick={() => setTone(value)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-sm border px-2 py-3 text-xs font-medium transition',
                TONE_SWATCH[value],
                tone === value ? 'ring-2 ring-text/60' : 'opacity-70 hover:opacity-100'
              )}
            >
              <Icon size={16} strokeWidth={2} />
              {CALLOUT_TONE_LABELS[value]}
            </button>
          )
        })}
      </div>
      <TextField
        label="Nagłówek (opcjonalny)"
        placeholder={CALLOUT_TONE_LABELS[tone]}
        value={title}
        maxLength={120}
        onChange={(event) => setTitle(event.target.value)}
      />
      <TextAreaField
        label="Treść"
        autoFocus
        rows={5}
        value={text}
        maxLength={1500}
        hint={`${text.length}/1500 · nowa linia = Enter`}
        onChange={(event) => {
          setText(event.target.value)
          setError('')
        }}
        error={error || undefined}
      />
    </Modal>
  )
}

// ─── polecane produkty ───────────────────────────────────────────────────────

export type ProductEmbedBlockValue = {
  title?: string
  products: Array<{ _type: 'reference'; _ref: string; _weak: true; _key: string }>
}

export function ProductEmbedDialog({
  initial,
  products,
  makeKey,
  onSubmit,
  onClose,
}: {
  initial?: ProductEmbedBlockValue
  products: EditorProduct[]
  makeKey: () => string
  onSubmit: (value: ProductEmbedBlockValue) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [selected, setSelected] = useState<string[]>(initial?.products.map((ref) => ref._ref) ?? [])
  const [search, setSearch] = useState('')
  const byId = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])
  const needle = normalizeText(search.trim())
  const candidates =
    needle.length >= 2
      ? products
          .filter((product) => !selected.includes(product.id))
          .filter((product) => normalizeText(`${product.title} ${product.sku ?? ''}`).includes(needle))
          .slice(0, 20)
      : []
  const full = selected.length >= PRODUCT_EMBED_MAX

  return (
    <Modal
      title={initial ? 'Edytuj polecane produkty' : 'Polecane produkty'}
      subtitle="Kafelki z ceną i linkiem do produktu, wstawione prosto w tekst."
      onClose={onClose}
      width="w-[min(600px,100%)]"
      as="form"
      onSubmit={(event) => {
        event.preventDefault()
        if (!selected.length) return
        const previous = new Map(initial?.products.map((ref) => [ref._ref, ref._key]))
        onSubmit({
          ...(title.trim() && { title: title.trim().slice(0, 120) }),
          products: selected.map((id) => ({ _type: 'reference', _ref: id, _weak: true, _key: previous.get(id) ?? makeKey() })),
        })
      }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anuluj
          </Button>
          <Button type="submit" disabled={!selected.length}>
            {initial ? 'Zapisz' : 'Wstaw'}
          </Button>
        </>
      }
    >
      <TextField
        label="Nagłówek sekcji (opcjonalny)"
        placeholder="Polecane produkty"
        value={title}
        maxLength={120}
        onChange={(event) => setTitle(event.target.value)}
      />

      <div className="grid gap-2">
        <span className="text-xs font-medium text-text-2">
          Wybrane ({selected.length}/{PRODUCT_EMBED_MAX})
        </span>
        {selected.length ? (
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {selected.map((id) => {
              const product = byId.get(id)
              return (
                <li key={id} className="flex items-center gap-2 rounded-xs border border-border bg-surface px-2 py-1.5">
                  <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xs bg-surface-muted">
                    {product?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`${product.imageUrl}?w=72&h=72&fit=crop`} alt="" className="size-9 object-cover" />
                    ) : (
                      <ImageOff size={14} strokeWidth={1.5} className="text-muted" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-text">{product?.title ?? 'Produkt usunięty z katalogu'}</span>
                    <span className="block truncate text-[11px] text-text-2">{product ? formatPrice(product.price) : id}</span>
                  </span>
                  {product?.status === 'draft' && <Badge tone="primary">szkic — niewidoczny</Badge>}
                  <IconButton label="Usuń z ramki" onClick={() => setSelected((current) => current.filter((item) => item !== id))}>
                    <X size={14} strokeWidth={1.5} />
                  </IconButton>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="m-0 text-xs text-text-2">Wyszukaj produkty poniżej (od 1 do {PRODUCT_EMBED_MAX}).</p>
        )}
      </div>

      <div className="grid gap-2">
        <div className={cn('flex h-10 items-center gap-2 px-3', FIELD_BASE, full && 'opacity-60')}>
          <Search size={14} strokeWidth={1.5} className="shrink-0 text-muted" />
          <input
            type="search"
            value={search}
            disabled={full}
            autoFocus
            onChange={(event) => setSearch(event.target.value)}
            placeholder={full ? `Maksymalnie ${PRODUCT_EMBED_MAX} produkty` : 'Szukaj po nazwie lub SKU…'}
            className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
            aria-label="Szukaj produktu"
          />
        </div>
        {needle.length >= 2 && !full && (
          <ul className="m-0 grid max-h-60 list-none gap-1 overflow-auto rounded-xs border border-border bg-surface-muted p-1.5">
            {candidates.length ? (
              candidates.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected((current) => (current.length >= PRODUCT_EMBED_MAX ? current : [...current, product.id]))
                      setSearch('')
                    }}
                    className="flex w-full items-center gap-2 rounded-xs px-2 py-1.5 text-left text-xs hover:bg-surface"
                  >
                    <Plus size={13} strokeWidth={1.5} className="shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate text-text">{product.title}</span>
                    <span className="shrink-0 text-text-2">{formatPrice(product.price)}</span>
                    {product.status === 'draft' && <Badge tone="primary">szkic</Badge>}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-2 py-1 text-xs text-text-2">Brak produktów pasujących do „{search.trim()}”.</li>
            )}
          </ul>
        )}
      </div>
    </Modal>
  )
}

// ─── zdjęcie w treści ────────────────────────────────────────────────────────

export type ImageDetails = { alt: string; caption: string }
export type ImageDialogResult = ImageDetails & { ref: string }

export function ImageDialog({
  imageRef,
  initial,
  onSubmit,
  onReplace,
  onClose,
}: {
  imageRef: string
  initial: ImageDetails
  onSubmit: (value: ImageDialogResult) => void
  onReplace: (file: File) => Promise<string | null>
  onClose: () => void
}) {
  const [alt, setAlt] = useState(initial.alt)
  const [caption, setCaption] = useState(initial.caption)
  const [ref, setRef] = useState(imageRef)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const preview = imageUrlFromRef(ref, 900)

  return (
    <Modal
      title="Zdjęcie"
      subtitle="Opis alternatywny czytają Google i czytniki ekranu. Podpis widać pod zdjęciem."
      onClose={onClose}
      width="w-[min(560px,100%)]"
      as="form"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({ ref, alt: alt.trim().slice(0, GUIDE_ALT_MAX), caption: caption.trim().slice(0, GUIDE_CAPTION_MAX) })
      }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anuluj
          </Button>
          <Button type="submit" disabled={busy}>
            Zapisz
          </Button>
        </>
      }
    >
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="max-h-64 w-full rounded-sm bg-surface-muted object-contain" />
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          setBusy(true)
          const next = await onReplace(file)
          setBusy(false)
          if (next) setRef(next)
        }}
      />
      <Button variant="secondary" size="sm" className="justify-self-start" disabled={busy} onClick={() => input.current?.click()}>
        <Upload size={13} strokeWidth={1.5} />
        {busy ? 'Wgrywanie…' : 'Zmień zdjęcie'}
      </Button>
      <TextField
        label="Tekst alternatywny"
        autoFocus
        value={alt}
        maxLength={GUIDE_ALT_MAX}
        placeholder="Np. Golden retriever w szelkach na spacerze w lesie"
        hint="Opisz, co jest na zdjęciu — jednym zdaniem."
        onChange={(event) => setAlt(event.target.value)}
      />
      <TextField
        label="Podpis (opcjonalny)"
        value={caption}
        maxLength={GUIDE_CAPTION_MAX}
        onChange={(event) => setCaption(event.target.value)}
      />
    </Modal>
  )
}
