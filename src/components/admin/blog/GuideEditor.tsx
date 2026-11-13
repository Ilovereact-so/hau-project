'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  CalendarClock,
  Check,
  CircleAlert,
  Clapperboard,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  ImagePlus,
  ListTree,
  Loader2,
  MoreHorizontal,
  PenLine,
  RotateCcw,
  Search as SearchIcon,
  Send,
  ShieldCheck,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react'
import type { PortableTextBlock } from '@portabletext/editor'
import {
  adminCreateGuideCategory,
  adminDeleteGuide,
  adminDiscardGuideDraft,
  adminDuplicateGuide,
  adminPublishGuide,
  adminReloadGuide,
  adminSaveGuide,
  adminUnpublishGuide,
} from '@/actions/adminGuides'
import { uploadAdminImage, uploadGuideVideoFile } from '@/lib/adminImageUpload'
import { BLOG_IMAGE_PREP, prepareImageForUpload } from '@/lib/imageUpload'
import type { GuideEditorDoc, GuideImageValue, GuideInput, GuideVideoValue } from '@/lib/admin/guides'
import {
  GUIDE_ALT_MAX,
  GUIDE_AUTHOR_MAX,
  GUIDE_EXCERPT_MAX,
  GUIDE_SEO_DESCRIPTION_MAX,
  GUIDE_SEO_TITLE_MAX,
  GUIDE_TITLE_MAX,
  GUIDE_VIDEO_MAX_BYTES,
  guideChecks,
  guideHeadings,
  guideStats,
  publishBlockers,
  sanitizeGuideBody,
  slugifyGuide,
} from '@/lib/guides/content'
import { parseVideoUrl } from '@/lib/video'
import GuideArticle from '@/components/guides/GuideArticle'
import { PublishStateLabel } from '@/lib/admin/labels'
import { Badge, PUBLISH_TONES, toneFor } from '../kit/Badge'
import { Button, IconButton } from '../kit/Button'
import { ErrorBox, NoticeBox } from '../kit/EmptyState'
import { Modal } from '../kit/Modal'
import { FIELD_BASE, SelectField, TextAreaField, TextField } from '../kit/TextField'
import { Toggle } from '../kit/Toggle'
import { formatDateTime } from '../kit/format'
import { cn } from '../kit/utils'
import type { ArticleEditorHandle, UploadResult } from './ArticleEditor'
import { ChecksList, Outline, Panel, ScoreBadge, SearchPreview, StatsGrid, checksScore } from './EditorPanels'
import {
  fileUrlFromRef,
  imageUrlFromRef,
  isoToLocalInput,
  localInputToIso,
  productsForPreview,
  type EditorCategory,
  type EditorGuideLink,
  type EditorProduct,
} from './shared'

/*
 * Ekran pisania artykułu: okładka, tytuł i zajawka nad treścią (jak w Medium),
 * edytor treści, panel boczny (publikacja, adres i SEO, film otwierający,
 * lista kontrolna, konspekt), podgląd 1:1 ze sklepem.
 *
 * Zapisy trafiają do SZKICU (patrz lib/admin/guides.ts): autozapis kilka sekund
 * po ostatniej zmianie, Ctrl+S, przycisk „Zapisz”. Sklep widzi zmiany dopiero
 * po „Opublikuj”. Dodatkowo kopia robocza w localStorage — na wypadek
 * zamkniętej karty albo utraty sieci w trakcie pisania.
 */

// Edytor tylko w przeglądarce: renderowany na serwerze dostawał losowe klucze
// bloków i React zgłaszał niezgodność hydracji.
const ArticleEditor = dynamic(() => import('./ArticleEditor').then((mod) => mod.ArticleEditor), {
  ssr: false,
  loading: () => (
    <div className="grid gap-3 pt-4" aria-busy>
      <div className="h-10 rounded-xs bg-surface-muted" />
      <div className="h-4 w-4/5 rounded-xs bg-surface-muted" />
      <div className="h-4 w-3/5 rounded-xs bg-surface-muted" />
      <div className="h-4 w-2/3 rounded-xs bg-surface-muted" />
    </div>
  ),
})

const AUTOSAVE_DELAY = 2500
const BACKUP_PREFIX = 'hau-blog-backup:'

type FormState = Omit<GuideInput, 'body'>
type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict'
type DocMeta = { id: string | null; rev: string | null; status: GuideEditorDoc['status'] | 'new'; updatedAt: string | null; publishedVersionAt: string | null }
type Backup = { form: FormState; body: unknown[]; at: string; rev: string | null }

function formFromDoc(doc: GuideEditorDoc | null): FormState {
  return {
    title: doc?.title ?? '',
    slug: doc?.slug ?? '',
    excerpt: doc?.excerpt ?? '',
    categoryId: doc?.categoryId ?? null,
    author: doc?.author ?? '',
    publishedAt: doc?.publishedAt ?? null,
    featured: doc?.featured ?? false,
    readingTime: doc?.readingTime ?? null,
    seoTitle: doc?.seoTitle ?? '',
    seoDescription: doc?.seoDescription ?? '',
    cover: doc?.cover ?? null,
    heroVideo: doc?.heroVideo ?? null,
  }
}

function metaFromDoc(doc: GuideEditorDoc | null): DocMeta {
  return {
    id: doc?.id ?? null,
    rev: doc?.rev ?? null,
    status: doc?.status ?? 'new',
    updatedAt: doc?.updatedAt ?? null,
    publishedVersionAt: doc?.publishedVersionAt ?? null,
  }
}

function readBackup(key: string): Backup | null {
  try {
    const raw = window.localStorage.getItem(BACKUP_PREFIX + key)
    return raw ? (JSON.parse(raw) as Backup) : null
  } catch {
    return null
  }
}
function writeBackup(key: string, backup: Backup) {
  try {
    window.localStorage.setItem(BACKUP_PREFIX + key, JSON.stringify(backup))
  } catch {
    /* pełny albo zablokowany storage — kopia robocza to tylko zabezpieczenie */
  }
}
function clearBackup(key: string) {
  try {
    window.localStorage.removeItem(BACKUP_PREFIX + key)
  } catch {
    /* jw. */
  }
}

/*
 * Zdjęcia i filmy idą zwykłymi trasami API z limitem czasu (lib/adminImageUpload),
 * nie server action — ta potrafiła na hostingu zawisnąć bez odpowiedzi przy
 * większych plikach („mieli” w nieskończoność). Zdjęcie przed wysyłką zmniejsza
 * przeglądarka (do 2560 px / ~2,5 MB), więc nawet plik prosto z aparatu
 * przechodzi szybko i mieści się w limicie serwera (10 MB).
 */
async function uploadGuideImageFile(file: File, guideId: string | null): Promise<UploadResult> {
  const prepared = await prepareImageForUpload(file, BLOG_IMAGE_PREP)
  const result = await uploadAdminImage<{ ref: string; url: string }>({ target: 'guide', id: guideId || 'nowy', file: prepared })
  return result.ok ? result.data : { error: result.error }
}

async function uploadGuideVideo(file: File): Promise<UploadResult> {
  // Sprawdzamy od razu — inaczej za duży film leciałby cały na serwer tylko po to, żeby dostać odmowę.
  if (file.size > GUIDE_VIDEO_MAX_BYTES) return { error: 'Film jest większy niż 11 MB — wrzuć go na YouTube/Vimeo i wklej link.' }
  const result = await uploadGuideVideoFile(file)
  return result.ok ? result.data : { error: result.error }
}

export function GuideEditor({
  initial,
  categories: initialCategories,
  products,
  guides,
}: {
  initial: GuideEditorDoc | null
  categories: EditorCategory[]
  products: EditorProduct[]
  guides: EditorGuideLink[]
}) {
  const router = useRouter()
  const editorRef = useRef<ArticleEditorHandle>(null)

  // Stan startowy tylko z propsów pierwszego renderu: AdminShell co minutę
  // odświeża dane serwera (router.refresh) i nowe propsy NIE mogą nadpisać
  // tego, co właśnie się pisze.
  const [meta, setMeta] = useState<DocMeta>(() => metaFromDoc(initial))
  const [form, setForm] = useState<FormState>(() => formFromDoc(initial))
  const [body, setBody] = useState<unknown[]>(() => initial?.body ?? [])
  const [editorSeed, setEditorSeed] = useState<{ key: number; value: unknown[] }>(() => ({ key: 0, value: initial?.body ?? [] }))
  const [categories, setCategories] = useState(initialCategories)
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState('')
  const [version, setVersion] = useState(0)
  const [savedVersion, setSavedVersion] = useState(0)
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug))
  const [backup, setBackup] = useState<Backup | null>(null)
  const [invalidBody, setInvalidBody] = useState('')
  const [dialog, setDialog] = useState<null | 'publish' | 'delete' | 'unpublish' | 'discard'>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)
  const [barHeight, setBarHeight] = useState(52)

  const metaRef = useRef(meta)
  const formRef = useRef(form)
  const bodyRef = useRef(body)
  const versionRef = useRef(version)
  const savingRef = useRef<Promise<boolean> | null>(null)
  const savedVersionRef = useRef(savedVersion)
  // Czy człowiek już coś zrobił w edytorze treści. Portable Text Editor potrafi
  // przy wczytaniu znormalizować wartość (np. dopisać puste `markDefs`) i
  // zgłosić to jako zmianę — bez tej flagi samo otwarcie opublikowanego
  // artykułu tworzyłoby szkic.
  const interactedRef = useRef(false)
  metaRef.current = meta
  formRef.current = form
  bodyRef.current = body
  versionRef.current = version

  const dirty = version !== savedVersion
  const touch = useCallback(() => setVersion((value) => value + 1), [])

  const update = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      setForm((current) => {
        const next = { ...current, [field]: value }
        // Slug podąża za tytułem, dopóki ktoś go nie zmieni ręcznie — i tylko
        // przed pierwszą publikacją (zmiana adresu psuje udostępnione linki).
        if (field === 'title' && !slugTouched && (metaRef.current.status === 'new' || metaRef.current.status === 'draft')) {
          next.slug = slugifyGuide(String(value))
        }
        return next
      })
      touch()
    },
    [slugTouched, touch],
  )

  // ── zapis ───────────────────────────────────────────────────────────────
  const currentInput = useCallback((): GuideInput => {
    const live = editorRef.current?.getValue()
    return { ...formRef.current, body: live ?? bodyRef.current }
  }, [])

  const save = useCallback(
    async ({ force = false, manual = false }: { force?: boolean; manual?: boolean } = {}): Promise<boolean> => {
      if (savingRef.current) {
        await savingRef.current
        // Kolejny zapis tylko, jeśli po poprzednim coś się zmieniło.
        if (!manual && versionRef.current === savedVersionRef.current) return true
      }
      const input = currentInput()
      if (!input.title.trim()) {
        if (manual) toast.error('Dodaj tytuł — bez niego artykułu nie da się zapisać.')
        return false
      }
      const startedAt = versionRef.current
      const run = (async () => {
        setSaveState('saving')
        const result = await adminSaveGuide(metaRef.current.id, input, force ? null : metaRef.current.rev)
        if (!result.ok) {
          setSaveState(result.conflict ? 'conflict' : 'error')
          setSaveError(result.error)
          if (manual && !result.conflict) toast.error(result.error)
          return false
        }
        const { data } = result
        const wasNew = !metaRef.current.id
        setMeta((current) => ({ ...current, id: data.id, rev: data.rev, status: data.status, updatedAt: data.updatedAt }))
        metaRef.current = { ...metaRef.current, id: data.id, rev: data.rev, status: data.status, updatedAt: data.updatedAt }
        setSavedVersion(startedAt)
        savedVersionRef.current = startedAt
        setSaveState(versionRef.current === startedAt ? 'saved' : 'dirty')
        setSaveError('')
        clearBackup(wasNew ? 'new' : data.id)
        if (wasNew) {
          // Adres zmieniamy bez nawigacji i ZOSTAJEMY na trasie /new (tylko
          // z ?id=): odświeżenie danych panelu (router.refresh co minutę)
          // renderuje wtedy tę samą stronę i nie montuje edytora od nowa,
          // a F5 wczytuje już zapisany artykuł.
          window.history.replaceState(null, '', `/admin/blog/new?id=${encodeURIComponent(data.id)}`)
        }
        if (data.dropped.length) toast(`Pominięto niepoprawne elementy: ${[...new Set(data.dropped)].join(', ')}.`, { icon: '⚠️' })
        if (manual) toast.success('Zapisano szkic')
        return true
      })()
      savingRef.current = run
      try {
        return await run
      } finally {
        savingRef.current = null
      }
    },
    [currentInput],
  )

  // Autozapis po chwili bez zmian. Po konflikcie czekamy na decyzję człowieka.
  useEffect(() => {
    if (!dirty || saveState === 'conflict' || saveState === 'saving') return
    if (saveState !== 'dirty' && saveState !== 'error') setSaveState('dirty')
    const timer = window.setTimeout(() => {
      if (formRef.current.title.trim()) void save()
    }, saveState === 'error' ? AUTOSAVE_DELAY * 4 : AUTOSAVE_DELAY)
    return () => window.clearTimeout(timer)
  }, [version, dirty, saveState, save])

  // Kopia robocza w przeglądarce (co ~1 s pisania).
  useEffect(() => {
    if (!dirty) return
    const timer = window.setTimeout(() => {
      writeBackup(metaRef.current.id ?? 'new', { form: formRef.current, body: bodyRef.current, at: new Date().toISOString(), rev: metaRef.current.rev })
    }, 900)
    return () => window.clearTimeout(timer)
  }, [version, dirty])

  // Przy wejściu: czy jest kopia robocza nowsza niż zapis w Sanity?
  useEffect(() => {
    const found = readBackup(initial?.id ?? 'new')
    if (!found) return
    const newer = !initial || new Date(found.at).getTime() > new Date(initial.updatedAt).getTime()
    const differs = JSON.stringify({ ...found.form, body: found.body }) !== JSON.stringify({ ...formFromDoc(initial), body: initial?.body ?? [] })
    if (newer && differs) setBackup(found)
    else clearBackup(initial?.id ?? 'new')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ctrl/Cmd+S = zapisz.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void save({ manual: true })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  // Ostrzeżenie przy zamykaniu karty i przy kliknięciu linku w panelu.
  useEffect(() => {
    const unsaved = () => versionRef.current !== savedVersionRef.current || Boolean(savingRef.current)
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!unsaved()) return
      event.preventDefault()
      event.returnValue = ''
    }
    const onClick = (event: MouseEvent) => {
      if (!unsaved() || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
      const anchor = (event.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank' || anchor.closest('[data-preview-root]')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return
      if (!window.confirm('Masz niezapisane zmiany (autozapis jeszcze nie zdążył). Wyjść mimo to?')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [])

  // Pasek narzędzi edytora przykleja się POD belką akcji — mierzymy jej wysokość
  // (zawija się na węższych ekranach).
  useEffect(() => {
    const node = barRef.current
    if (!node) return
    const observer = new ResizeObserver(() => setBarHeight(node.offsetHeight))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // ── wczytanie wersji z serwera (konflikt, odrzucenie zmian) ────────────
  const applyDoc = useCallback((doc: GuideEditorDoc) => {
    setMeta(metaFromDoc(doc))
    metaRef.current = metaFromDoc(doc)
    setForm(formFromDoc(doc))
    setBody(doc.body)
    setEditorSeed((current) => ({ key: current.key + 1, value: doc.body }))
    setSlugTouched(true)
    interactedRef.current = false
    setSavedVersion(versionRef.current)
    savedVersionRef.current = versionRef.current
    setSaveState('saved')
    setSaveError('')
  }, [])

  const reload = async () => {
    if (!meta.id) return
    setBusy(true)
    const result = await adminReloadGuide(meta.id)
    setBusy(false)
    if (!result.ok) return toast.error(result.error)
    applyDoc(result.data)
    toast.success('Wczytano najnowszą wersję')
  }

  /** Po publikacji/wycofaniu zmienia się `_rev` i status — treść zostaje. */
  const refreshMeta = async (id: string) => {
    const result = await adminReloadGuide(id)
    if (result.ok) {
      const next = metaFromDoc(result.data)
      setMeta(next)
      metaRef.current = next
      setForm((current) => ({ ...current, publishedAt: result.data.publishedAt }))
    }
  }

  // ── pochodne ────────────────────────────────────────────────────────────
  const stats = useMemo(() => guideStats(body), [body])
  const headings = useMemo(() => guideHeadings(body), [body])
  const readingTime = form.readingTime ?? stats.readingTime
  const checksInput = {
    title: form.title,
    slug: form.slug,
    excerpt: form.excerpt,
    seoTitle: form.seoTitle,
    seoDescription: form.seoDescription,
    categoryId: form.categoryId,
    cover: form.cover ? { hasImage: true, alt: form.cover.alt } : null,
    publishedAt: form.publishedAt ?? new Date().toISOString(),
    body,
  }
  const checks = useMemo(() => guideChecks(checksInput), [form, body]) // eslint-disable-line react-hooks/exhaustive-deps
  const blockers = useMemo(() => publishBlockers(checksInput), [form, body]) // eslint-disable-line react-hooks/exhaustive-deps
  const score = checksScore(checks)
  const productMap = useMemo(() => productsForPreview(products), [products])
  const scheduled = Boolean(form.publishedAt && new Date(form.publishedAt).getTime() > Date.now())
  const isLive = meta.status === 'published' || meta.status === 'changed'
  const liveSlug = isLive ? initial?.slug || form.slug : form.slug

  // ── akcje ───────────────────────────────────────────────────────────────
  const publish = async () => {
    setBusy(true)
    try {
      if (dirty || !meta.id) {
        const ok = await save({ manual: false })
        if (!ok) {
          toast.error(saveError || 'Najpierw trzeba zapisać artykuł.')
          return
        }
      }
      const id = metaRef.current.id!
      const result = await adminPublishGuide(id, formRef.current.slug)
      if (!result.ok) return toast.error(result.error)
      setDialog(null)
      await refreshMeta(id)
      toast.success(result.data.scheduledFor ? `Zaplanowano na ${formatDateTime(result.data.scheduledFor)}` : 'Opublikowano — artykuł jest w sklepie')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const unpublish = async () => {
    if (!meta.id) return
    setBusy(true)
    const result = await adminUnpublishGuide(meta.id, liveSlug)
    setBusy(false)
    if (!result.ok) return toast.error(result.error)
    setDialog(null)
    await refreshMeta(meta.id)
    toast.success('Wycofano ze sklepu — artykuł jest teraz szkicem')
  }

  const discard = async () => {
    if (!meta.id) return
    setBusy(true)
    const result = await adminDiscardGuideDraft(meta.id)
    if (!result.ok) {
      setBusy(false)
      return toast.error(result.error)
    }
    const reloaded = await adminReloadGuide(meta.id)
    setBusy(false)
    setDialog(null)
    if (reloaded.ok) applyDoc(reloaded.data)
    clearBackup(meta.id)
    toast.success('Odrzucono zmiany — przywrócono wersję ze sklepu')
  }

  const remove = async () => {
    if (!meta.id) {
      clearBackup('new')
      router.push('/admin/blog')
      return
    }
    setBusy(true)
    const result = await adminDeleteGuide(meta.id, liveSlug)
    setBusy(false)
    if (!result.ok) return toast.error(result.error)
    clearBackup(meta.id)
    setVersion(0)
    setSavedVersion(0)
    versionRef.current = 0
    savedVersionRef.current = 0
    toast.success('Usunięto artykuł')
    router.push('/admin/blog')
  }

  const duplicate = async () => {
    if (!meta.id) return
    if (dirty && !(await save())) return
    setBusy(true)
    const result = await adminDuplicateGuide(meta.id)
    setBusy(false)
    if (!result.ok) return toast.error(result.error)
    toast.success('Utworzono kopię (szkic)')
    router.push(`/admin/blog/${result.data}`)
  }

  const uploadCover = async (file: File) => {
    setBusy(true)
    const result = await uploadGuideImageFile(file, meta.id)
    setBusy(false)
    if ('error' in result) return toast.error(result.error)
    update('cover', { ref: result.ref, alt: form.cover?.alt || form.title.slice(0, 120) })
  }

  const addCategory = async (title: string) => {
    const result = await adminCreateGuideCategory({ title })
    if (!result.ok) {
      toast.error(result.error)
      return false
    }
    setCategories((current) => [...current, { id: result.data.id, title: result.data.title, slug: result.data.slug }])
    update('categoryId', result.data.id)
    toast.success(`Dodano kategorię „${result.data.title}”`)
    return true
  }

  // ── render ──────────────────────────────────────────────────────────────
  const publishLabel =
    meta.status === 'published' && !dirty
      ? 'Opublikowano'
      : meta.status === 'changed' || (meta.status === 'published' && dirty)
        ? 'Opublikuj zmiany'
        : scheduled
          ? 'Zaplanuj'
          : 'Opublikuj'

  return (
    <div className="grid gap-4" style={{ '--blog-bar': `${barHeight}px` } as React.CSSProperties}>
      {/* Belka akcji — przyklejona nad treścią. */}
      <div ref={barRef} className="sticky top-0 z-30 -mx-4 -mt-3 flex flex-wrap items-center gap-2 border-b border-border bg-bg/95 px-4 pt-[22px] pb-2.5 backdrop-blur sm:-mx-5 sm:px-5 lg:-mx-7 lg:px-7">
        <Link href="/admin/blog" className="inline-flex items-center gap-1.5 rounded-xs px-2 py-1.5 text-xs font-medium text-text-2 hover:bg-surface-muted hover:text-text">
          <ArrowLeft size={14} strokeWidth={1.75} />
          Artykuły
        </Link>
        <span className="h-5 w-px bg-border" aria-hidden />
        {meta.status === 'new' ? (
          <Badge tone="neutral">Nowy</Badge>
        ) : (
          <Badge tone={toneFor(PUBLISH_TONES, meta.status)}>{PublishStateLabel[meta.status]}</Badge>
        )}
        {isLive && scheduled && <Badge tone="purple">zaplanowany</Badge>}
        <SaveIndicator state={saveState} updatedAt={meta.updatedAt} error={saveError} onRetry={() => void save({ manual: true })} />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-xs border border-border bg-surface p-0.5" role="tablist" aria-label="Widok">
            {(['edit', 'preview'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={view === value}
                onClick={() => setView(value)}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-xs font-medium transition-colors',
                  view === value ? 'bg-bg text-text shadow-pill' : 'text-text-2 hover:text-text'
                )}
              >
                {value === 'edit' ? <PenLine size={13} strokeWidth={1.75} /> : <Eye size={13} strokeWidth={1.75} />}
                {value === 'edit' ? 'Edycja' : 'Podgląd'}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => void save({ manual: true })} disabled={saveState === 'saving' || !form.title.trim()}>
            Zapisz
          </Button>
          <Button size="sm" onClick={() => setDialog('publish')} disabled={busy || (meta.status === 'published' && !dirty)}>
            {scheduled ? <CalendarClock size={14} strokeWidth={1.75} /> : <Send size={14} strokeWidth={1.75} />}
            {publishLabel}
          </Button>
          <div className="relative">
            <IconButton label="Więcej akcji" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen}>
              <MoreHorizontal size={15} strokeWidth={1.75} />
            </IconButton>
            {menuOpen && (
              <ActionsMenu
                onClose={() => setMenuOpen(false)}
                items={[
                  isLive && liveSlug
                    ? { label: 'Zobacz w sklepie', icon: ExternalLink, href: `/poradniki/${liveSlug}` }
                    : null,
                  meta.id ? { label: 'Duplikuj', icon: Copy, onClick: duplicate } : null,
                  meta.status === 'changed' ? { label: 'Odrzuć zmiany szkicu', icon: Undo2, onClick: () => setDialog('discard') } : null,
                  isLive ? { label: 'Wycofaj ze sklepu', icon: RotateCcw, onClick: () => setDialog('unpublish') } : null,
                  { label: meta.id ? 'Usuń artykuł' : 'Porzuć szkic', icon: Trash2, onClick: () => setDialog('delete'), danger: true },
                ]}
              />
            )}
          </div>
        </div>
      </div>

      {saveState === 'conflict' && (
        <div className="flex flex-wrap items-center gap-3 rounded-sm border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger">
          <CircleAlert size={16} strokeWidth={1.75} className="shrink-0" />
          <span className="min-w-0 flex-1">{saveError}</span>
          <Button size="sm" variant="secondary" disabled={busy} onClick={reload}>
            Wczytaj wersję z serwera
          </Button>
          <Button size="sm" variant="danger" disabled={busy} onClick={() => void save({ force: true, manual: true })}>
            Nadpisz moją wersją
          </Button>
        </div>
      )}

      {backup && (
        <NoticeBox className="flex flex-wrap items-center gap-3">
          <span className="min-w-0 flex-1">
            W tej przeglądarce jest niezapisana kopia tego artykułu z {formatDateTime(backup.at)}. Przywrócić ją?
          </span>
          <Button
            size="sm"
            onClick={() => {
              setForm(backup.form)
              setBody(backup.body)
              setEditorSeed((current) => ({ key: current.key + 1, value: backup.body }))
              setSlugTouched(true)
              setBackup(null)
              interactedRef.current = true
              touch()
            }}
          >
            Przywróć
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              clearBackup(meta.id ?? 'new')
              setBackup(null)
            }}
          >
            Odrzuć kopię
          </Button>
        </NoticeBox>
      )}

      {view === 'preview' ? (
        <PreviewFrame>
          <GuideArticle
            preview
            products={productMap}
            guide={{
              title: form.title,
              excerpt: form.excerpt,
              category: categories.find((category) => category.id === form.categoryId) ?? null,
              author: form.author,
              publishedAt: form.publishedAt ?? new Date().toISOString(),
              updatedAt: null,
              readingTime,
              coverImage: form.cover ? { asset: { _ref: form.cover.ref }, alt: form.cover.alt } : null,
              heroVideo: form.heroVideo
                ? {
                    provider: form.heroVideo.provider,
                    url: form.heroVideo.url,
                    fileUrl: fileUrlFromRef(form.heroVideo.fileRef) ?? undefined,
                    caption: form.heroVideo.caption,
                    poster: form.heroVideo.poster ? { asset: { _ref: form.heroVideo.poster.ref }, alt: form.heroVideo.poster.alt } : undefined,
                  }
                : null,
              body: (editorRef.current?.getValue() as unknown[] | null) ?? body,
            }}
          />
        </PreviewFrame>
      ) : null}

      <div className={cn('grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]', view === 'preview' && 'hidden')}>
        {/* ── kolumna pisania ── */}
        <div className="min-w-0">
          <div className="mx-auto max-w-[800px]">
            <CoverField
              value={form.cover}
              busy={busy}
              onUpload={uploadCover}
              onAlt={(alt) => form.cover && update('cover', { ...form.cover, alt })}
              onRemove={() => update('cover', null)}
            />

            <AutoTextarea
              value={form.title}
              onChange={(value) => update('title', value.replace(/\n/g, ' '))}
              placeholder="Tytuł artykułu"
              maxLength={GUIDE_TITLE_MAX}
              ariaLabel="Tytuł artykułu"
              className="mt-6 font-poppins text-[clamp(26px,3vw,36px)] leading-tight font-semibold tracking-[-0.02em] text-text"
            />
            <AutoTextarea
              value={form.excerpt}
              onChange={(value) => update('excerpt', value.replace(/\n/g, ' '))}
              placeholder="Zajawka — 1–2 zdania: o czym jest tekst i co czytelnik z niego wyniesie. Widać ją na kafelku i w Google."
              maxLength={GUIDE_EXCERPT_MAX}
              ariaLabel="Zajawka"
              className="mt-3 font-poppins text-[18px] leading-relaxed text-text-2"
            />
            <div className="mt-1 flex justify-end">
              <Counter value={form.excerpt.length} max={GUIDE_EXCERPT_MAX} ideal={[120, GUIDE_EXCERPT_MAX]} />
            </div>

            {invalidBody && (
              <ErrorBox className="mt-4">
                <span className="flex flex-wrap items-center gap-2">
                  Treść zawiera elementy, których edytor nie rozpoznaje ({invalidBody}).
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => {
                      const { body: fixed } = sanitizeGuideBody(editorRef.current?.getValue() ?? body)
                      setBody(fixed)
                      setEditorSeed((current) => ({ key: current.key + 1, value: fixed }))
                      setInvalidBody('')
                      interactedRef.current = true
                      touch()
                    }}
                  >
                    Napraw automatycznie
                  </button>
                </span>
              </ErrorBox>
            )}

            <div
              className="mt-4"
              onKeyDownCapture={() => (interactedRef.current = true)}
              onMouseDownCapture={() => (interactedRef.current = true)}
              onPasteCapture={() => (interactedRef.current = true)}
              onDropCapture={() => (interactedRef.current = true)}
            >
              <ArticleEditor
                key={editorSeed.key}
                ref={editorRef}
                initialValue={editorSeed.value}
                onEdit={() => {
                  if (interactedRef.current) touch()
                }}
                onChange={(value: PortableTextBlock[]) => {
                  setBody(value)
                  if (interactedRef.current) touch()
                }}
                onInvalidValue={setInvalidBody}
                products={products}
                guides={guides.filter((guide) => guide.id !== meta.id)}
                uploadImage={(file) => uploadGuideImageFile(file, meta.id)}
                uploadVideo={uploadGuideVideo}
              />
            </div>
          </div>
        </div>

        {/* ── panel boczny ── */}
        <aside className="grid content-start gap-3">
          <Panel title="Publikacja" icon={Send}>
            <SelectField
              label="Kategoria"
              value={form.categoryId ?? ''}
              onChange={(event) => update('categoryId', event.target.value || null)}
              options={[{ value: '', label: '— wybierz —' }, ...categories.map((category) => ({ value: category.id, label: category.title }))]}
            />
            <NewCategory onCreate={addCategory} />
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-text-2">Data publikacji</span>
              <span className="flex gap-2">
                <input
                  type="datetime-local"
                  value={isoToLocalInput(form.publishedAt)}
                  onChange={(event) => update('publishedAt', localInputToIso(event.target.value))}
                  className={cn('h-10 min-w-0 flex-1 px-3', FIELD_BASE)}
                />
                {form.publishedAt && (
                  <IconButton label="Wyczyść datę" className="size-10" onClick={() => update('publishedAt', null)}>
                    <X size={14} strokeWidth={1.75} />
                  </IconButton>
                )}
              </span>
              <span className="text-[11px] text-text-2">
                {!form.publishedAt
                  ? 'Puste = data i godzina kliknięcia „Opublikuj”.'
                  : scheduled
                    ? 'Data w przyszłości — artykuł pojawi się w sklepie sam o tej porze.'
                    : 'Decyduje o kolejności na liście poradników.'}
              </span>
            </label>
            <TextField
              label="Autor"
              value={form.author}
              maxLength={GUIDE_AUTHOR_MAX}
              placeholder="Zespół HAU"
              onChange={(event) => update('author', event.target.value)}
            />
            <div className="flex items-center justify-between gap-3 rounded-xs border border-border bg-bg px-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-xs font-medium text-text">Wyróżniony</span>
                <span className="block text-[11px] text-text-2">Duży kafelek na górze /poradniki</span>
              </span>
              <Toggle checked={form.featured} label="Wyróżniony" onChange={() => update('featured', !form.featured)} />
            </div>
            {meta.publishedVersionAt && (
              <p className="m-0 text-[11px] text-text-2">Wersja w sklepie z {formatDateTime(meta.publishedVersionAt)}.</p>
            )}
          </Panel>

          <Panel title="Adres i SEO" icon={SearchIcon} aside={<ScoreBadge score={score} />}>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-text-2">Adres (slug)</span>
              <span className={cn('flex h-10 items-center overflow-hidden', FIELD_BASE)}>
                <span className="shrink-0 pl-3 text-xs text-text-2">/poradniki/</span>
                <input
                  value={form.slug}
                  onChange={(event) => {
                    setSlugTouched(true)
                    update('slug', event.target.value.toLowerCase().replace(/\s+/g, '-'))
                  }}
                  onBlur={() => update('slug', slugifyGuide(form.slug || form.title))}
                  className="h-full min-w-0 flex-1 bg-transparent pr-3 text-sm text-text outline-none"
                  aria-label="Slug"
                />
              </span>
              {isLive && initial?.slug && form.slug !== initial.slug ? (
                <span className="text-[11px] text-danger">
                  Zmiana adresu opublikowanego artykułu psuje linki, które ktoś już udostępnił.
                </span>
              ) : !slugTouched ? (
                <span className="text-[11px] text-text-2">Tworzy się z tytułu.</span>
              ) : null}
            </label>
            <TextField
              label="Tytuł SEO (opcjonalny)"
              value={form.seoTitle}
              maxLength={GUIDE_SEO_TITLE_MAX}
              placeholder={form.title || 'Pusty = tytuł artykułu'}
              hint={<Counter value={form.seoTitle.length} max={GUIDE_SEO_TITLE_MAX} ideal={[30, 55]} inline />}
              onChange={(event) => update('seoTitle', event.target.value)}
            />
            <TextAreaField
              label="Opis SEO (opcjonalny)"
              rows={3}
              value={form.seoDescription}
              maxLength={GUIDE_SEO_DESCRIPTION_MAX}
              placeholder="Pusty = zajawka"
              hint={<Counter value={form.seoDescription.length} max={GUIDE_SEO_DESCRIPTION_MAX} ideal={[120, 160]} inline />}
              onChange={(event) => update('seoDescription', event.target.value)}
            />
            <SearchPreview title={form.title} excerpt={form.excerpt} seoTitle={form.seoTitle} seoDescription={form.seoDescription} slug={form.slug} />
          </Panel>

          <Panel title="Kontrola jakości" icon={ShieldCheck} aside={<ScoreBadge score={score} />}>
            <ChecksList checks={checks} />
          </Panel>

          <Panel title="Konspekt" icon={ListTree} aside={<span className="text-[11px] text-text-2">{headings.length}</span>}>
            <Outline headings={headings} onJump={(key) => editorRef.current?.scrollToBlock(key)} />
          </Panel>

          <Panel title="Statystyki" icon={FileText} defaultOpen={false}>
            <StatsGrid stats={stats} readingTime={readingTime} />
            <TextField
              label="Czas czytania (min) — nadpisz"
              type="number"
              min={1}
              max={120}
              value={form.readingTime ?? ''}
              placeholder={`${stats.readingTime} (automatycznie)`}
              onChange={(event) => update('readingTime', event.target.value ? Math.max(1, Math.min(120, Number(event.target.value))) : null)}
            />
          </Panel>

          <Panel title="Film otwierający" icon={Clapperboard} defaultOpen={Boolean(form.heroVideo)}>
            <HeroVideoField value={form.heroVideo} onChange={(value) => update('heroVideo', value)} />
          </Panel>
        </aside>
      </div>

      {dialog === 'publish' && (
        <Modal
          title={scheduled && !isLive ? 'Zaplanuj publikację' : meta.status === 'changed' || (isLive && dirty) ? 'Opublikuj zmiany' : 'Opublikuj artykuł'}
          subtitle={
            scheduled
              ? `Artykuł pojawi się w sklepie ${formatDateTime(form.publishedAt)} — do tego czasu jest ukryty.`
              : 'Artykuł od razu pojawi się na liście poradników i pod swoim adresem.'
          }
          onClose={() => setDialog(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDialog(null)}>
                Anuluj
              </Button>
              <Button onClick={publish} disabled={busy || blockers.length > 0}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={2} />}
                {scheduled ? 'Zaplanuj' : 'Opublikuj'}
              </Button>
            </>
          }
        >
          {blockers.length ? (
            <ErrorBox>
              <span className="grid gap-1">
                <span className="font-semibold">Uzupełnij przed publikacją:</span>
                {blockers.map((blocker) => (
                  <span key={blocker}>• {blocker}</span>
                ))}
              </span>
            </ErrorBox>
          ) : (
            <div className="grid gap-2 text-xs text-text-2">
              <p className="m-0">
                Adres: <code className="text-text">/poradniki/{form.slug}</code>
              </p>
              <p className="m-0">
                Kontrola jakości: <ScoreBadge score={score} />{' '}
                {checks.some((check) => check.level === 'warn') && 'są uwagi — możesz publikować, ale warto je przejrzeć.'}
              </p>
            </div>
          )}
        </Modal>
      )}

      {dialog === 'unpublish' && (
        <ConfirmDialog
          title="Wycofać artykuł ze sklepu?"
          body="Artykuł zniknie z listy poradników i spod swojego adresu (404). Treść zostaje jako szkic — możesz go opublikować ponownie."
          confirm="Wycofaj"
          busy={busy}
          onConfirm={unpublish}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'discard' && (
        <ConfirmDialog
          title="Odrzucić zmiany szkicu?"
          body="Wszystkie niepublikowane zmiany przepadną — edytor wróci do wersji, którą widać w sklepie."
          confirm="Odrzuć zmiany"
          busy={busy}
          onConfirm={discard}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'delete' && (
        <ConfirmDialog
          title={meta.id ? 'Usunąć artykuł na zawsze?' : 'Porzucić ten szkic?'}
          body={
            meta.id
              ? 'Usuwa opublikowaną wersję i szkic. Tego nie da się cofnąć — jeśli chcesz tylko ukryć artykuł, wybierz „Wycofaj ze sklepu”.'
              : 'Artykuł nie był jeszcze zapisany — wpisany tekst przepadnie.'
          }
          confirm={meta.id ? 'Usuń' : 'Porzuć'}
          danger
          busy={busy}
          onConfirm={remove}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

// ─── części ekranu ───────────────────────────────────────────────────────────

function SaveIndicator({ state, updatedAt, error, onRetry }: { state: SaveState; updatedAt: string | null; error: string; onRetry: () => void }) {
  const base = 'inline-flex items-center gap-1.5 text-[11px]'
  if (state === 'saving')
    return (
      <span className={cn(base, 'text-text-2')}>
        <Loader2 size={12} className="animate-spin" /> Zapisywanie…
      </span>
    )
  if (state === 'dirty') return <span className={cn(base, 'text-text-2')}>Niezapisane zmiany</span>
  if (state === 'error')
    return (
      <span className={cn(base, 'text-danger')} title={error}>
        <CircleAlert size={12} /> Nie zapisano ·{' '}
        <button type="button" className="font-semibold underline" onClick={onRetry}>
          spróbuj ponownie
        </button>
      </span>
    )
  if (state === 'conflict') return <span className={cn(base, 'text-danger')}>Konflikt wersji</span>
  if (!updatedAt) return <span className={cn(base, 'text-text-2')}>Szkic nie jest jeszcze zapisany</span>
  return (
    <span className={cn(base, 'text-text-2')}>
      <Check size={12} className="text-success" /> Zapisano {formatDateTime(updatedAt)}
    </span>
  )
}

function Counter({ value, max, ideal, inline }: { value: number; max: number; ideal: [number, number]; inline?: boolean }) {
  const tone = value === 0 ? 'text-text-2' : value > max ? 'text-danger' : value >= ideal[0] && value <= ideal[1] ? 'text-success' : 'text-[#d97706]'
  return (
    <span className={cn('text-[11px] tabular-nums', tone, !inline && 'font-medium')}>
      {value}/{max}
      {inline && value > 0 && value < ideal[0] ? ' · krótko' : ''}
    </span>
  )
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
  maxLength,
  className,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  maxLength: number
  className?: string
  ariaLabel: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.style.height = '0px'
    node.style.height = `${node.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      maxLength={maxLength}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        // Enter w tytule/zajawce przenosi do kolejnego pola zamiast łamać linię.
        if (event.key === 'Enter') event.preventDefault()
      }}
      className={cn('block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none placeholder:text-muted', className)}
    />
  )
}

function CoverField({
  value,
  busy,
  onUpload,
  onAlt,
  onRemove,
}: {
  value: GuideImageValue | null
  busy: boolean
  onUpload: (file: File) => void
  onAlt: (alt: string) => void
  onRemove: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const src = imageUrlFromRef(value?.ref, 1600)
  const pick = () => input.current?.click()
  const onDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith('image/'))
    if (file) onUpload(file)
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onUpload(file)
        }}
      />
      {src ? (
        <div className="group relative aspect-[16/9] overflow-hidden rounded-[18px] bg-surface-muted" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={value?.alt ?? ''} className="size-full object-cover" />
          <div className="absolute top-3 right-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Button size="sm" variant="secondary" onClick={pick} disabled={busy}>
              <Upload size={13} strokeWidth={1.75} /> Zmień okładkę
            </Button>
            <IconButton label="Usuń okładkę" onClick={onRemove} className="bg-bg">
              <X size={14} strokeWidth={1.75} />
            </IconButton>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed px-6 py-10 text-center transition-colors',
            dragging ? 'border-primary bg-primary/10' : 'border-border-strong bg-surface-muted hover:border-text-2'
          )}
        >
          {busy ? <Loader2 size={22} className="animate-spin text-text-2" /> : <ImagePlus size={22} strokeWidth={1.5} className="text-text-2" />}
          <span className="text-sm font-medium text-text">{busy ? 'Wgrywanie…' : 'Dodaj okładkę'}</span>
          <span className="text-xs text-text-2">Kliknij albo upuść zdjęcie · poziome 16:9, najlepiej 1600×900 px</span>
        </button>
      )}
      {value && (
        <div className="mt-2">
          <TextField
            label="Opis okładki (tekst alternatywny)"
            value={value.alt}
            maxLength={GUIDE_ALT_MAX}
            placeholder="Np. Pies w nowych szelkach na spacerze"
            error={value.alt.trim() ? undefined : 'Wymagany do publikacji — opisz, co jest na zdjęciu.'}
            onChange={(event) => onAlt(event.target.value)}
          />
        </div>
      )}
    </div>
  )
}

function HeroVideoField({ value, onChange }: { value: GuideVideoValue | null; onChange: (value: GuideVideoValue | null) => void }) {
  if (value?.provider === 'file') {
    const url = fileUrlFromRef(value.fileRef)
    return (
      <div className="grid gap-2">
        {url && <video src={url} controls preload="metadata" className="aspect-video w-full rounded-xs bg-black" />}
        <p className="m-0 text-[11px] text-text-2">Plik wgrany do Sanity. Na stronie zastępuje okładkę.</p>
        <Button size="sm" variant="danger" onClick={() => onChange(null)} className="justify-self-start">
          Usuń film
        </Button>
      </div>
    )
  }
  const url = value?.url ?? ''
  const parsed = parseVideoUrl(url)
  return (
    <div className="grid gap-2">
      <TextField
        label="Link YouTube / Vimeo"
        value={url}
        placeholder="https://www.youtube.com/watch?v=…"
        error={url && !parsed.embedUrl ? 'Nie rozpoznajemy tego linku — wklej adres filmu z YouTube albo Vimeo.' : undefined}
        hint="Na stronie artykułu film zastąpi okładkę (okładka zostaje na kafelku)."
        onChange={(event) => {
          const next = event.target.value
          onChange(next.trim() ? { provider: 'external', url: next, caption: value?.caption } : null)
        }}
      />
      {parsed.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={parsed.thumbnailUrl.replace('maxresdefault', 'hqdefault')} alt="" className="aspect-video w-full rounded-xs object-cover" />
      )}
      {value && (
        <TextField
          label="Podpis pod filmem"
          value={value.caption ?? ''}
          maxLength={200}
          onChange={(event) => onChange({ ...value, caption: event.target.value })}
        />
      )}
    </div>
  )
}

function NewCategory({ onCreate }: { onCreate: (title: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="-mt-1 justify-self-start text-[11px] font-medium text-text-2 underline underline-offset-2 hover:text-text">
        + Nowa kategoria
      </button>
    )
  }
  const submit = async () => {
    if (!title.trim()) return
    setBusy(true)
    const ok = await onCreate(title.trim())
    setBusy(false)
    if (ok) {
      setTitle('')
      setOpen(false)
    }
  }
  return (
    <div className="flex gap-2">
      <input
        autoFocus
        value={title}
        maxLength={80}
        placeholder="Nazwa kategorii"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void submit()
          }
          if (event.key === 'Escape') setOpen(false)
        }}
        className={cn('h-8 min-w-0 flex-1 px-2.5 text-xs', FIELD_BASE)}
      />
      <Button size="sm" onClick={submit} disabled={busy || !title.trim()}>
        Dodaj
      </Button>
      <IconButton label="Anuluj" onClick={() => setOpen(false)}>
        <X size={13} />
      </IconButton>
    </div>
  )
}

type MenuItem = { label: string; icon: typeof Copy; onClick?: () => void; href?: string; danger?: boolean } | null

function ActionsMenu({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.parentElement?.contains(event.target as Node)) onClose()
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  const className = (danger?: boolean) =>
    cn('flex w-full items-center gap-2 rounded-xs px-2.5 py-2 text-left text-xs font-medium hover:bg-surface-muted', danger ? 'text-danger' : 'text-text')
  return (
    <div ref={ref} role="menu" className="absolute top-10 right-0 z-40 w-56 rounded-md border border-border bg-bg p-1.5 shadow-2 animate-fade-in">
      {items.filter((entry): entry is NonNullable<MenuItem> => Boolean(entry)).map((item) =>
        item.href ? (
          <a key={item.label} role="menuitem" href={item.href} target="_blank" rel="noopener noreferrer" className={className()} onClick={onClose}>
            <item.icon size={14} strokeWidth={1.75} />
            {item.label}
          </a>
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={className(item.danger)}
            onClick={() => {
              onClose()
              item.onClick?.()
            }}
          >
            <item.icon size={14} strokeWidth={1.75} />
            {item.label}
          </button>
        ),
      )}
    </div>
  )
}

function ConfirmDialog({
  title,
  body,
  confirm,
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  title: string
  body: string
  confirm: string
  danger?: boolean
  busy: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal
      title={title}
      subtitle={body}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anuluj
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} className={danger ? 'border border-danger/40' : undefined} onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            {confirm}
          </Button>
        </>
      }
    >
      {null}
    </Modal>
  )
}

/** Podgląd w „kartce” sklepu: jasne tło niezależnie od motywu panelu, linki nie wyprowadzają z edytora. */
function PreviewFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-preview-root
      className="rounded-[20px] border border-border bg-white px-5 py-8 text-[#20201F] shadow-1 sm:px-10 sm:py-12"
      onClickCapture={(event) => {
        const anchor = (event.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
        if (anchor && !anchor.getAttribute('href')?.startsWith('#')) {
          event.preventDefault()
          toast('W podglądzie linki są wyłączone — działają po publikacji.', { icon: '🔗' })
        }
      }}
    >
      <div className="mb-8 flex items-center justify-center gap-2 text-[11px] font-medium tracking-[0.08em] text-[#8A8A8A] uppercase">
        <Eye size={13} /> Podgląd — tak artykuł zobaczą czytelnicy
      </div>
      {children}
    </div>
  )
}
