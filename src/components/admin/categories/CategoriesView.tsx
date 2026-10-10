'use client'

import { uploadAdminImage } from '@/lib/adminImageUpload'
import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  Check, ExternalLink, FileText, FolderTree, ImageOff, ImagePlus, Layers, Pencil, RefreshCw, Trash2, X,
} from 'lucide-react'
import { TaxonomySeoModal } from './TaxonomySeoModal'
import { hasRichText } from '@/lib/richText'
import type { AdminCategory, AdminSubcategory } from '@/lib/admin/catalog'
import {
  adminRemoveSubcategoryImage, adminRenameTaxonomy,
} from '@/actions/adminProducts'
import { Badge } from '../kit/Badge'
import { ButtonLink, IconButton } from '../kit/Button'
import { Card, CardHeader } from '../kit/Card'
import { EmptyState, ErrorBox } from '../kit/EmptyState'
import { PillButton, PillSearch } from '../kit/Pill'
import { formatCurrency } from '../kit/format'
import { cn } from '../kit/utils'

/**
 * Kategorie i subkategorie sklepu (Sanity).
 *
 * Jak w meblove: panel pozwala „ubrać” kategorie — nazwa i zdjęcie —
 * a liczniki i cena „od” są LICZONE z produktów przy każdym odczycie.
 * Zakładanie nowych gałęzi drzewa (i filtry) zostaje w Sanity Studio.
 */
export function CategoriesView({
  categories,
  orphans,
  query,
  loadError,
}: {
  categories: AdminCategory[]
  orphans: AdminSubcategory[]
  query: string
  loadError?: string
}) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const [search, setSearch] = useState('')
  const needle = (search || query).trim().toLowerCase()

  const groups = useMemo(() => {
    const all = [
      ...categories,
      ...(orphans.length
        ? [{ id: '__orphans', title: 'Bez kategorii nadrzędnej', slug: null, description: null, metaTitle: null, metaDescription: null, seoContent: null, productCount: 0, subcategories: orphans }]
        : []),
    ]
    if (!needle) return all
    return all
      .map((category) => {
        const own = `${category.title} ${category.slug ?? ''}`.toLowerCase().includes(needle)
        return {
          ...category,
          subcategories: own
            ? category.subcategories
            : category.subcategories.filter((sub) => `${sub.title} ${sub.slug ?? ''}`.toLowerCase().includes(needle)),
          matched: own,
        }
      })
      .filter((category) => category.matched || category.subcategories.length)
  }, [categories, orphans, needle])

  const subTotal = categories.reduce((sum, category) => sum + category.subcategories.length, 0) + orphans.length
  const withPhoto =
    categories.reduce((sum, category) => sum + category.subcategories.filter((sub) => sub.imageUrl).length, 0) +
    orphans.filter((sub) => sub.imageUrl).length

  return (
    <section className="flex flex-col gap-4 animate-fade-in">
      <Card className="flex flex-col">
        <CardHeader
          icon={Layers}
          title="Kategorie"
          subtitle={`${categories.length} kategorii · ${subTotal} subkategorii · ${withPhoto} ze zdjęciem`}
          actions={
            <>
              <PillSearch value={search} onChange={setSearch} placeholder="Szukaj kategorii…" />
              <PillButton icon={RefreshCw} onClick={() => startRefresh(() => router.refresh())} disabled={refreshing}>
                Odśwież
              </PillButton>
              <ButtonLink href="/studio/structure/category" target="_blank" rel="noopener noreferrer" size="sm" variant="secondary">
                <ExternalLink size={14} strokeWidth={1.5} />
                Nowa kategoria w Studio
              </ButtonLink>
            </>
          }
        />
        <div className="px-4 pt-3 pb-4">
          {loadError && <ErrorBox className="mb-3">{loadError}</ErrorBox>}
          {!groups.length && (
            <EmptyState icon={<Layers size={20} strokeWidth={1.5} />} title={categories.length ? 'Brak wyników' : 'Brak kategorii'}>
              {categories.length
                ? `Żadna kategoria nie pasuje do „${search || query}”.`
                : 'Kategorie i subkategorie zakłada się w Sanity Studio — po utworzeniu pojawią się tutaj.'}
            </EmptyState>
          )}
        </div>
      </Card>

      {groups.map((category) => (
        <CategoryGroup key={category.id} category={category} />
      ))}
    </section>
  )
}

/** Przycisk „Opis i SEO” + okno edycji (kategoria albo subkategoria). */
function SeoButton({
  id,
  title,
  kind,
  path,
  seo,
}: {
  id: string
  title: string
  kind: 'category' | 'subcategory'
  path: string | null
  seo: { description: string | null; metaTitle: string | null; metaDescription: string | null; seoContent: unknown[] | null }
}) {
  const [open, setOpen] = useState(false)
  const filled = hasRichText(seo.seoContent)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xs border border-border bg-surface px-2 py-1 text-[11px] font-medium text-text-2 hover:text-text"
        title={filled ? 'Opis SEO uzupełniony' : 'Brak opisu SEO'}
      >
        <FileText size={12} strokeWidth={1.5} />
        Opis i SEO
        <span className={cn('size-1.5 rounded-full', filled ? 'bg-success' : 'bg-border-strong')} aria-hidden />
      </button>
      {open && <TaxonomySeoModal id={id} title={title} kind={kind} path={path} initial={seo} onClose={() => setOpen(false)} />}
    </>
  )
}

function CategoryGroup({ category }: { category: AdminCategory }) {
  const isOrphans = category.id === '__orphans'
  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 items-start gap-2">
          <FolderTree size={16} strokeWidth={1.5} className="mt-1 shrink-0 text-text-2" />
          {isOrphans ? (
            <div>
              <h2 className="m-0 text-sm font-semibold tracking-tight text-text">{category.title}</h2>
              <p className="mt-1 mb-0 text-xs text-text-2">Te subkategorie nie mają rodzica — nie pojawią się w menu sklepu.</p>
            </div>
          ) : (
            <InlineTitle id={category.id} title={category.title} subtitle={category.slug ? `/${category.slug}` : 'bez sluga'} size="lg" />
          )}
        </div>
        {!isOrphans && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={category.productCount ? 'success' : 'neutral'}>{`${category.productCount} produktów`}</Badge>
            <Badge tone="info">{`${category.subcategories.length} subkategorii`}</Badge>
            <SeoButton id={category.id} title={category.title} kind="category" path={category.slug ? `/category/${category.slug}` : null} seo={category} />
            {category.slug && (
              <a href={`/category/${category.slug}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-text-2 hover:text-text">
                w sklepie ↗
              </a>
            )}
          </div>
        )}
      </div>
      <div className="px-4 pt-3 pb-4">
        {category.subcategories.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {category.subcategories.map((sub) => (
              <SubcategoryCard key={sub.id} sub={sub} />
            ))}
          </div>
        ) : (
          <p className="m-0 text-xs text-text-2">Ta kategoria nie ma jeszcze subkategorii.</p>
        )}
      </div>
    </Card>
  )
}

function InlineTitle({
  id,
  title,
  subtitle,
  size = 'md',
}: {
  id: string
  title: string
  subtitle?: string
  size?: 'md' | 'lg'
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(title)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    const next = value.trim()
    if (!next || next === title) {
      setEditing(false)
      setValue(title)
      return
    }
    setBusy(true)
    setError('')
    const result = await adminRenameTaxonomy(id, next)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success('Nazwa zapisana')
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={value}
            maxLength={120}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void save()
              if (event.key === 'Escape') {
                setEditing(false)
                setValue(title)
              }
            }}
            className="h-8 min-w-0 flex-1 rounded-xs border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-border-strong focus:ring-2 focus:ring-primary/25"
          />
          <IconButton label="Zapisz nazwę" onClick={() => void save()} disabled={busy}>
            <Check size={14} strokeWidth={2} />
          </IconButton>
          <IconButton
            label="Anuluj"
            onClick={() => {
              setEditing(false)
              setValue(title)
            }}
          >
            <X size={14} strokeWidth={1.5} />
          </IconButton>
        </div>
        {error && <p className="m-0 text-[11px] text-danger">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex min-w-0 items-start gap-2">
      <div className="min-w-0">
        <h3 className={cn('m-0 truncate font-semibold tracking-tight text-text', size === 'lg' ? 'text-sm' : 'text-sm')}>{title}</h3>
        {subtitle && <code className="font-mono text-[11px] text-text-2">{subtitle}</code>}
      </div>
      <IconButton label="Zmień nazwę" onClick={() => setEditing(true)} className="size-7">
        <Pencil size={13} strokeWidth={1.5} />
      </IconButton>
    </div>
  )
}

function SubcategoryCard({ sub }: { sub: AdminSubcategory }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [image, setImage] = useState(sub.imageUrl)
  const fileRef = useRef<HTMLInputElement>(null)

  /* Wybór pliku jest sam w sobie decyzją — zapisujemy od razu, bez „Zapisz”. */
  const upload = async (file: File) => {
    setBusy(true)
    setError('')
    const result = await uploadAdminImage<string>({ target: 'subcategory', id: sub.id, alt: sub.title, file })
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
    if (!result.ok) {
      setError(result.error)
      return
    }
    setImage(result.data)
    toast.success('Zdjęcie zapisane')
    router.refresh()
  }

  const removePhoto = async () => {
    if (!window.confirm(`Usunąć zdjęcie subkategorii „${sub.title}”?`)) return
    setBusy(true)
    setError('')
    const result = await adminRemoveSubcategoryImage(sub.id)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setImage(null)
    router.refresh()
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-md border border-border bg-surface shadow-1">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-muted">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${image}?w=480&h=360&fit=crop`} alt={sub.title} className="size-full object-cover" loading="lazy" />
        ) : (
          <span className="grid size-full place-items-center text-muted">
            <ImageOff size={22} strokeWidth={1.5} />
          </span>
        )}

        <div className="absolute top-2 right-2 flex gap-1.5">
          <IconButton label={image ? 'Zmień zdjęcie' : 'Dodaj zdjęcie'} onClick={() => fileRef.current?.click()} disabled={busy}>
            <ImagePlus size={14} strokeWidth={1.5} />
          </IconButton>
          {image && (
            <IconButton label="Usuń zdjęcie" className="text-danger hover:border-danger/50" onClick={() => void removePhoto()} disabled={busy}>
              <Trash2 size={14} strokeWidth={1.5} />
            </IconButton>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
          }}
        />

        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-surface/70 text-xs font-medium text-text-2">Zapisuję…</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <InlineTitle id={sub.id} title={sub.title} subtitle={sub.slug ? `/subcategory/${sub.slug}` : 'bez sluga'} />

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={sub.productCount ? 'success' : 'neutral'}>{`${sub.productCount} w sklepie`}</Badge>
          {!image && <Badge tone="primary">bez zdjęcia</Badge>}
          <SeoButton id={sub.id} title={sub.title} kind="subcategory" path={sub.slug ? `/subcategory/${sub.slug}` : null} seo={sub} />
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-border pt-2.5">
          <div className="min-w-0">
            <p className="m-0 text-[11px] text-text-2">Cena od</p>
            <p className="m-0 text-sm font-semibold text-text">
              {sub.minPrice !== null ? formatCurrency(sub.minPrice) : <span className="text-text-2">—</span>}
            </p>
          </div>
          <span className="flex items-center gap-2">
            {sub.slug && (
              <a
                href={`/subcategory/${sub.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-medium text-text-2 hover:text-text"
              >
                w sklepie ↗
              </a>
            )}
            <a href={`/admin/products?category=${sub.id}`} className="text-[11px] font-medium text-text-2 hover:text-text">
              produkty →
            </a>
          </span>
        </div>

        {error && <p className="m-0 text-[11px] text-danger">{error}</p>}
      </div>
    </article>
  )
}
