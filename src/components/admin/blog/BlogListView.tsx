'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { BookOpenText, CalendarClock, Copy, ExternalLink, FolderOpen, ImageOff, PenLine, Plus, Star, Video } from 'lucide-react'
import type { AdminGuideRow } from '@/lib/admin/guides'
import { adminDuplicateGuide, adminSetGuideFeatured } from '@/actions/adminGuides'
import { PublishStateLabel } from '@/lib/admin/labels'
import { Badge, PUBLISH_TONES, toneFor } from '../kit/Badge'
import { ButtonLink, IconButton, IconLink } from '../kit/Button'
import { Card, CardHeader } from '../kit/Card'
import { EmptyState, ErrorBox } from '../kit/EmptyState'
import { PillButton, PillSearch, PillSelect } from '../kit/Pill'
import { Toggle } from '../kit/Toggle'
import { formatDate, formatDateTime } from '../kit/format'
import { cn } from '../kit/utils'
import { articlesLabel, imageUrlFromRef, type EditorCategory } from './shared'

type Filter = 'all' | 'published' | 'changed' | 'draft' | 'scheduled' | 'featured'

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'Wszystkie' },
  { value: 'published', label: 'W sklepie' },
  { value: 'scheduled', label: 'Zaplanowane' },
  { value: 'changed', label: 'Zmiany w szkicu' },
  { value: 'draft', label: 'Szkice' },
  { value: 'featured', label: 'Wyróżnione' },
]

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
}

/**
 * Lista artykułów bloga: filtry statusu i kategorii, wyszukiwanie (także
 * z paska u góry — parametr `q`), szybkie wyróżnianie i duplikowanie.
 * Pisanie i publikacja — w edytorze (/admin/blog/[id]).
 */
export function BlogListView({
  guides,
  categories,
  initialQuery,
  loadError,
}: {
  guides: AdminGuideRow[]
  categories: EditorCategory[]
  initialQuery: string
  loadError?: string
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState(initialQuery)
  const [pending, startTransition] = useTransition()
  const [featuredOverride, setFeaturedOverride] = useState<Record<string, boolean>>({})

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: guides.length, published: 0, changed: 0, draft: 0, scheduled: 0, featured: 0 }
    for (const guide of guides) {
      if (guide.scheduled) result.scheduled++
      else if (guide.status !== 'draft') result.published++
      if (guide.status === 'changed') result.changed++
      if (guide.status === 'draft') result.draft++
      if (guide.featured) result.featured++
    }
    return result
  }, [guides])

  const visible = useMemo(() => {
    const needle = normalize(query.trim())
    return guides.filter((guide) => {
      const featured = featuredOverride[guide.id] ?? guide.featured
      if (filter === 'published' && (guide.status === 'draft' || guide.scheduled)) return false
      if (filter === 'scheduled' && !guide.scheduled) return false
      if (filter === 'changed' && guide.status !== 'changed') return false
      if (filter === 'draft' && guide.status !== 'draft') return false
      if (filter === 'featured' && !featured) return false
      if (category === '__none' ? guide.category : category && guide.category?.id !== category) return false
      if (needle && !normalize(`${guide.title} ${guide.excerpt ?? ''} ${guide.slug ?? ''} ${guide.author ?? ''}`).includes(needle)) return false
      return true
    })
  }, [guides, filter, category, query, featuredOverride])

  const toggleFeatured = (guide: AdminGuideRow) => {
    const next = !(featuredOverride[guide.id] ?? guide.featured)
    setFeaturedOverride((current) => ({ ...current, [guide.id]: next }))
    startTransition(async () => {
      const result = await adminSetGuideFeatured(guide.id, next)
      if (!result.ok) {
        setFeaturedOverride((current) => ({ ...current, [guide.id]: !next }))
        toast.error(result.error)
        return
      }
      toast.success(next ? 'Wyróżniono artykuł' : 'Zdjęto wyróżnienie')
      router.refresh()
    })
  }

  const duplicate = (guide: AdminGuideRow) =>
    startTransition(async () => {
      const result = await adminDuplicateGuide(guide.id)
      if (!result.ok) return void toast.error(result.error)
      toast.success('Utworzono kopię (szkic)')
      router.push(`/admin/blog/${result.data}`)
    })

  return (
    <div className="grid gap-4">
      {loadError && <ErrorBox>{loadError}</ErrorBox>}

      <Card>
        <CardHeader
          icon={BookOpenText}
          title="Artykuły"
          subtitle={`${articlesLabel(visible.length)}${visible.length !== guides.length ? ` z ${guides.length}` : ''} · zapis w edytorze trafia do szkicu, sklep widzi dopiero publikację`}
          actions={
            <>
              <ButtonLink href="/admin/blog/categories" variant="secondary" size="sm">
                <FolderOpen size={14} strokeWidth={1.75} />
                Kategorie
              </ButtonLink>
              <ButtonLink href="/admin/blog/new" size="sm">
                <Plus size={14} strokeWidth={2} />
                Nowy artykuł
              </ButtonLink>
            </>
          }
        />
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          {FILTERS.map((item) => (
            <PillButton key={item.value} active={filter === item.value} onClick={() => setFilter(item.value)}>
              {item.label}
              <span className="tabular-nums text-text-2">{counts[item.value]}</span>
            </PillButton>
          ))}
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <PillSelect
              label="Kategoria"
              value={category}
              onChange={setCategory}
              options={[
                { value: '', label: 'Wszystkie kategorie' },
                ...categories.map((item) => ({ value: item.id, label: item.title })),
                { value: '__none', label: 'Bez kategorii' },
              ]}
            />
            <PillSearch value={query} onChange={setQuery} placeholder="Szukaj artykułu…" />
          </span>
        </div>

        <div className={cn('grid gap-2 p-4', pending && 'opacity-70')}>
          {!guides.length ? (
            <EmptyState icon={<BookOpenText size={20} strokeWidth={1.5} />} title="Blog czeka na pierwszy wpis">
              Napisz poradnik — z okładką, śródtytułami, zdjęciami, filmami i polecanymi produktami. Zanim go opublikujesz, zobaczysz podgląd 1:1 ze sklepem.
            </EmptyState>
          ) : !visible.length ? (
            <p className="m-0 px-1 py-8 text-center text-xs text-text-2">Żaden artykuł nie pasuje do wybranych filtrów.</p>
          ) : (
            visible.map((guide) => {
              const featured = featuredOverride[guide.id] ?? guide.featured
              const cover = imageUrlFromRef(guide.coverRef, 320)
              const live = guide.status !== 'draft'
              return (
                <article
                  key={guide.id}
                  className="group grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 rounded-sm border border-border bg-bg p-2.5 transition-colors hover:border-border-strong sm:grid-cols-[120px_minmax(0,1fr)_auto]"
                >
                  <Link href={`/admin/blog/${guide.id}`} className="relative block aspect-[16/10] overflow-hidden rounded-xs bg-surface-muted" tabIndex={-1}>
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" className="size-full object-cover" loading="lazy" />
                    ) : (
                      <span className="grid size-full place-items-center text-muted">
                        <ImageOff size={16} strokeWidth={1.5} />
                      </span>
                    )}
                    {guide.hasVideo && (
                      <span className="absolute bottom-1 left-1 grid size-5 place-items-center rounded-full bg-black/60 text-white">
                        <Video size={11} />
                      </span>
                    )}
                  </Link>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {guide.scheduled ? (
                        <Badge tone="purple">
                          <CalendarClock size={11} className="mr-1" />
                          Zaplanowany · {formatDateTime(guide.publishedAt)}
                        </Badge>
                      ) : (
                        <Badge tone={toneFor(PUBLISH_TONES, guide.status)}>{PublishStateLabel[guide.status]}</Badge>
                      )}
                      {guide.scheduled && guide.status === 'changed' && <Badge tone="info">zmiany w szkicu</Badge>}
                      {guide.category ? <Badge variant={1}>{guide.category.title}</Badge> : <Badge tone="danger">bez kategorii</Badge>}
                      {featured && (
                        <Badge tone="primary">
                          <Star size={10} className="mr-1 fill-current" />
                          wyróżniony
                        </Badge>
                      )}
                    </div>
                    <Link href={`/admin/blog/${guide.id}`} className="mt-1 block truncate text-sm font-semibold text-text hover:underline underline-offset-2">
                      {guide.title}
                    </Link>
                    {guide.excerpt && <p className="m-0 mt-0.5 line-clamp-1 text-xs text-text-2">{guide.excerpt}</p>}
                    <p className="m-0 mt-1 text-[11px] text-text-2">
                      {guide.publishedAt ? formatDate(guide.publishedAt) : 'bez daty publikacji'} · {guide.readingTime} min · {guide.words.toLocaleString('pl-PL')} słów
                      {guide.author ? ` · ${guide.author}` : ''} · zmiana {formatDateTime(guide.updatedAt)}
                    </p>
                  </div>

                  <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
                    <span className="flex items-center gap-1.5 text-[11px] text-text-2" title="Wyróżniony = duży kafelek na górze /poradniki (zmiana od razu w sklepie)">
                      <Star size={12} />
                      <Toggle checked={featured} label="Wyróżniony" disabled={pending} onChange={() => toggleFeatured(guide)} />
                    </span>
                    {live && guide.slug && (
                      <a
                        href={`/poradniki/${guide.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Zobacz w sklepie"
                        title="Zobacz w sklepie"
                        className="grid size-8 place-items-center rounded-xs border border-border bg-bg text-text-2 hover:border-border-strong hover:text-text"
                      >
                        <ExternalLink size={14} strokeWidth={1.5} />
                      </a>
                    )}
                    <IconButton label="Duplikuj" onClick={() => duplicate(guide)} disabled={pending}>
                      <Copy size={14} strokeWidth={1.5} />
                    </IconButton>
                    <IconLink href={`/admin/blog/${guide.id}`} label="Edytuj">
                      <PenLine size={14} strokeWidth={1.5} />
                    </IconLink>
                  </div>
                </article>
              )
            })
          )}
        </div>
      </Card>
    </div>
  )
}
