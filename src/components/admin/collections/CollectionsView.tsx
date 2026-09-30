'use client'

import { uploadAdminImage } from '@/lib/adminImageUpload'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ExternalLink, Eye, EyeOff, ImageOff, ImagePlus, Layers, Pencil, Plus, RefreshCw, Search, Trash2, X,
} from 'lucide-react'
import type { AdminCollection, CollectionProduct } from '@/lib/admin/collections'
import {
  adminAddProductsToCollection,
  adminCreateCollection,
  adminDeleteCollection,
  adminGetCollectionProducts,
  adminRemoveCollectionImage,
  adminRemoveProductFromCollection,
  adminSetCollectionPublished,
  adminUpdateCollection,
} from '@/actions/adminCollections'
import { COLLECTION_SORTS, COLLECTION_SORT_LABELS, slugifyCollection } from '@/sanity/lib/collectionRefs'
import { PublishStateLabel } from '@/lib/admin/labels'
import { Badge, PUBLISH_TONES, toneFor } from '../kit/Badge'
import { Button, IconButton } from '../kit/Button'
import { Card, CardHeader } from '../kit/Card'
import { EmptyState, ErrorBox, NoticeBox } from '../kit/EmptyState'
import { Modal } from '../kit/Modal'
import { PillButton, PillSearch } from '../kit/Pill'
import { FIELD_BASE, SelectField, TextAreaField, TextField } from '../kit/TextField'
import { formatDateTime } from '../kit/format'
import { cn } from '../kit/utils'

export type CatalogProductLite = {
  id: string
  title: string
  sku: string | null
  imageUrl: string | null
  status: 'published' | 'changed' | 'draft'
  collectionIds: string[]
}

const SORT_OPTIONS = COLLECTION_SORTS.map((value) => ({ value, label: COLLECTION_SORT_LABELS[value] }))

function productsLabel(count: number) {
  if (count === 1) return 'produkt'
  const last = count % 10
  const lastTwo = count % 100
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'produkty'
  return 'produktów'
}

// ─── produkty w kolekcji ──────────────────────────────────────────────────────

function CollectionProductsEditor({
  collectionId,
  catalog,
  onChanged,
}: {
  collectionId: string
  catalog: CatalogProductLite[]
  onChanged: () => void
}) {
  const [items, setItems] = useState<CollectionProduct[] | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [busy, startBusy] = useTransition()

  const load = async () => {
    const result = await adminGetCollectionProducts(collectionId)
    if (!result.ok) {
      setError(result.error)
      setItems([])
      return
    }
    setItems(result.data)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId])

  const memberIds = useMemo(() => new Set((items ?? []).map((item) => item.id)), [items])
  const needle = search.trim().toLowerCase()
  const candidates = needle.length >= 2
    ? catalog
        .filter((product) => !memberIds.has(product.id))
        .filter((product) => `${product.title} ${product.sku ?? ''}`.toLowerCase().includes(needle))
        .slice(0, 30)
    : []

  const add = () =>
    startBusy(async () => {
      setError('')
      const result = await adminAddProductsToCollection(collectionId, picked)
      if (!result.ok) return setError(result.error)
      toast.success(`Dodano ${result.data} ${productsLabel(result.data)}`)
      setPicked([])
      setSearch('')
      await load()
      onChanged()
    })

  const remove = (product: CollectionProduct) =>
    startBusy(async () => {
      setError('')
      const result = await adminRemoveProductFromCollection(collectionId, product.id)
      if (!result.ok) return setError(result.error)
      toast.success('Usunięto z kolekcji')
      setItems((current) => (current ?? []).filter((item) => item.id !== product.id))
      onChanged()
    })

  return (
    <div className="grid content-start gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-2">
          Produkty w kolekcji {items ? `(${items.length})` : ''}
        </span>
      </div>

      <div className={cn('flex h-10 items-center gap-2 px-3', FIELD_BASE)}>
        <Search size={14} strokeWidth={1.5} className="shrink-0 text-muted" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Szukaj produktu po nazwie lub SKU, aby dodać…"
          className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
          aria-label="Szukaj produktu do dodania"
        />
      </div>

      {needle.length >= 2 && (
        <div className="grid gap-2 rounded-xs border border-border bg-surface-muted p-2">
          {candidates.length ? (
            <ul className="grid max-h-56 gap-1 overflow-auto">
              {candidates.map((product) => {
                const checked = picked.includes(product.id)
                return (
                  <li key={product.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xs px-2 py-1.5 text-xs hover:bg-surface">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setPicked((current) => (checked ? current.filter((id) => id !== product.id) : [...current, product.id]))
                        }
                      />
                      <span className="min-w-0 flex-1 truncate text-text">{product.title}</span>
                      {product.sku && <code className="font-mono text-[10px] text-text-2">{product.sku}</code>}
                      {product.status === 'draft' && <Badge tone="primary">szkic</Badge>}
                    </label>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="m-0 px-2 py-1 text-xs text-text-2">Brak produktów spoza kolekcji pasujących do „{search.trim()}”.</p>
          )}
          <div className="flex justify-end">
            <Button size="sm" disabled={!picked.length || busy} onClick={add}>
              <Plus size={14} strokeWidth={2} />
              Dodaj zaznaczone ({picked.length})
            </Button>
          </div>
        </div>
      )}

      {error && <ErrorBox>{error}</ErrorBox>}

      {items === null ? (
        <p className="m-0 text-xs text-text-2">Wczytywanie…</p>
      ) : items.length ? (
        <ul className={cn('grid max-h-72 gap-1 overflow-auto', busy && 'opacity-60')}>
          {items.map((product) => (
            <li key={product.id} className="flex items-center gap-2 rounded-xs border border-border bg-surface px-2 py-1.5">
              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xs bg-surface-muted">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${product.imageUrl}?w=72&h=72&fit=crop`} alt="" className="size-9 object-cover" />
                ) : (
                  <ImageOff size={14} strokeWidth={1.5} className="text-muted" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-text">{product.title}</span>
                <span className="block truncate text-[11px] text-text-2">{product.sku ?? '—'}</span>
              </span>
              {product.status === 'draft' && <Badge tone="primary">szkic — niewidoczny</Badge>}
              <IconButton label={`Usuń „${product.title}” z kolekcji`} disabled={busy} onClick={() => remove(product)}>
                <X size={14} strokeWidth={1.5} />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-xs text-text-2">Brak produktów. Wyszukaj je powyżej albo przypisz kolekcję w formularzu produktu.</p>
      )}
    </div>
  )
}

// ─── edycja kolekcji ──────────────────────────────────────────────────────────

function CollectionModal({
  collection,
  catalog,
  onClose,
  onChanged,
}: {
  collection: AdminCollection | null
  catalog: CatalogProductLite[]
  onClose: () => void
  onChanged: () => void
}) {
  const isNew = !collection
  const [title, setTitle] = useState(collection?.title ?? '')
  const [slug, setSlug] = useState(collection?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(collection?.slug))
  const [description, setDescription] = useState(collection?.description ?? '')
  const [sort, setSort] = useState(collection?.sort ?? 'newest')
  const [imageUrl, setImageUrl] = useState(collection?.imageUrl ?? null)
  const [error, setError] = useState('')
  const [saving, startSaving] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [dirty, setDirty] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const effectiveSlug = slugifyCollection(slugTouched ? slug : title)

  const close = () => {
    if (dirty) onChanged()
    onClose()
  }

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim()) return setError('Podaj nazwę kolekcji.')
    if (!effectiveSlug) return setError('Adres musi zawierać litery lub cyfry.')
    setError('')
    const input = { title, slug: effectiveSlug, description, sort }
    startSaving(async () => {
      const result = collection ? await adminUpdateCollection(collection.id, input) : await adminCreateCollection(input)
      if (!result.ok) return setError(result.error)
      toast.success(collection ? 'Kolekcja zapisana' : 'Kolekcja utworzona jako szkic — dodaj produkty i opublikuj')
      onChanged()
      onClose()
    })
  }

  const upload = async (files: FileList | null) => {
    if (!collection || !files?.[0]) return
    const file = files[0]
    // Limit serwera to 10 MB — większy plik odrzuciłby już Next (limit ciała
    // akcji) twardym błędem 500, zanim akcja zdąży zwrócić komunikat.
    if (file.size > 10 * 1024 * 1024) {
      setError('Zdjęcie jest większe niż 10 MB — zmniejsz je i spróbuj ponownie.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setUploading(true)
    setError('')
    try {
      const result = await uploadAdminImage<string>({ target: 'collection', id: collection.id, alt: title || collection.title, file })
      if (!result.ok) return setError(result.error)
      setImageUrl(result.data)
      setDirty(true)
    } catch (err) {
      // Błąd sieci / serwera (np. limit rozmiaru na hostingu) — bez tego
      // przycisk wracał do stanu początkowego bez żadnej informacji.
      console.error('[collections] upload', err)
      setError('Nie udało się wysłać zdjęcia (błąd serwera). Spróbuj mniejszego pliku albo odśwież stronę.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removeImage = async () => {
    if (!collection || !window.confirm('Usunąć zdjęcie kolekcji?')) return
    const result = await adminRemoveCollectionImage(collection.id)
    if (!result.ok) return setError(result.error)
    setImageUrl(null)
    setDirty(true)
  }

  return (
    <Modal
      as="form"
      onSubmit={submit}
      title={isNew ? 'Nowa kolekcja' : `Kolekcja: ${collection.title}`}
      subtitle={
        isNew
          ? 'Kolekcja powstaje jako szkic. Produkty i zdjęcie dodasz po zapisaniu.'
          : 'Zmiany nazwy i opisu trafiają do obu wersji dokumentu. Przypisanie produktów działa od razu.'
      }
      width="w-[min(900px,100%)]"
      onClose={close}
      footer={
        <>
          {collection && (
            <a
              href={`/studio/structure/collection;${collection.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mr-auto inline-flex items-center gap-1.5 self-center text-xs font-medium text-text-2 hover:text-text"
            >
              Otwórz w Sanity Studio <ExternalLink size={12} strokeWidth={1.5} />
            </a>
          )}
          <Button variant="secondary" onClick={close}>
            Zamknij
          </Button>
          <Button type="submit" disabled={saving || uploading}>
            {saving ? 'Zapisywanie…' : isNew ? 'Utwórz szkic' : 'Zapisz zmiany'}
          </Button>
        </>
      }
    >
      <div className={cn('grid gap-5', !isNew && 'lg:grid-cols-2')}>
        <div className="flex flex-col gap-3">
          <TextField label="Nazwa" required autoFocus value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          <TextField
            label="Adres strony"
            value={slugTouched ? slug : effectiveSlug}
            maxLength={96}
            className="font-mono"
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value)
            }}
            hint={effectiveSlug ? `/kolekcje/${effectiveSlug}` : 'Uzupełnij nazwę lub adres.'}
          />
          <TextAreaField label="Opis (nagłówek strony kolekcji)" rows={3} maxLength={600} value={description} onChange={(e) => setDescription(e.target.value)} />
          <SelectField label="Domyślna kolejność produktów" value={sort} onChange={(e) => setSort(e.target.value)} options={SORT_OPTIONS} />

          {!isNew && (
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-text-2">Zdjęcie nagłówka</span>
              <div className="flex items-center gap-3">
                <span className="grid h-20 w-32 place-items-center overflow-hidden rounded-xs border border-border bg-surface-muted">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${imageUrl}?w=320&h=200&fit=crop`} alt="" className="size-full object-cover" />
                  ) : (
                    <ImageOff size={18} strokeWidth={1.5} className="text-muted" />
                  )}
                </span>
                <div className="flex flex-col gap-1.5">
                  <Button size="sm" variant="secondary" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    <ImagePlus size={14} strokeWidth={1.5} />
                    {uploading ? 'Wysyłam…' : imageUrl ? 'Zmień' : 'Dodaj zdjęcie'}
                  </Button>
                  {imageUrl && (
                    <Button size="sm" variant="danger" onClick={() => void removeImage()}>
                      <Trash2 size={14} strokeWidth={1.5} />
                      Usuń
                    </Button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void upload(e.target.files)} />
              </div>
              <span className="text-[11px] text-text-2">Bez zdjęcia strona użyje zdjęcia najnowszego produktu z kolekcji.</span>
            </div>
          )}
        </div>

        {collection && (
          <CollectionProductsEditor collectionId={collection.id} catalog={catalog} onChanged={() => setDirty(true)} />
        )}
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
    </Modal>
  )
}

// ─── lista ────────────────────────────────────────────────────────────────────

export function CollectionsView({
  collections,
  catalog,
  query,
  loadError,
}: {
  collections: AdminCollection[]
  catalog: CatalogProductLite[]
  query: string
  loadError?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<AdminCollection | 'new' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const needle = (search || query).trim().toLowerCase()
  const rows = needle
    ? collections.filter((c) => `${c.title} ${c.slug ?? ''} ${c.description ?? ''}`.toLowerCase().includes(needle))
    : collections
  const drafts = collections.filter((c) => c.status === 'draft').length

  const refresh = () => startTransition(() => router.refresh())

  const act = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(key)
    setError('')
    const result = await fn()
    setBusy(null)
    if (!result.ok) return setError(result.error ?? 'Operacja nie powiodła się.')
    toast.success(success)
    refresh()
  }

  const togglePublished = (collection: AdminCollection) => {
    const publish = collection.status !== 'published'
    if (!publish && !window.confirm(`Wycofać „${collection.title}” ze sklepu?\n\nStrona kolekcji przestanie działać, a przycisk banera z tą kolekcją zniknie.`)) return
    if (publish && collection.productCount === 0 && !window.confirm(`„${collection.title}” nie ma opublikowanych produktów. Opublikować mimo to?`)) return
    void act(
      `publish-${collection.id}`,
      () => adminSetCollectionPublished(collection.id, publish),
      publish ? 'Kolekcja opublikowana' : 'Kolekcja wycofana do szkicu',
    )
  }

  const remove = (collection: AdminCollection) => {
    if (!window.confirm(`Usunąć kolekcję „${collection.title}”?\n\nProdukty zostaną, zniknie tylko ich przypisanie do tej kolekcji. Banery z nią stracą przycisk.`)) return
    void act(`delete-${collection.id}`, () => adminDeleteCollection(collection.id), 'Kolekcja usunięta')
  }

  return (
    <section className="flex flex-col gap-4 animate-fade-in">
      <Card className="flex flex-col">
        <CardHeader
          icon={Layers}
          title="Kolekcje"
          subtitle={`${collections.length} kolekcji · ${drafts} szkiców. Baner na stronie głównej linkuje do opublikowanej kolekcji.`}
          actions={
            <>
              <PillSearch value={search} onChange={setSearch} placeholder="Szukaj kolekcji…" />
              <PillButton icon={RefreshCw} onClick={refresh} disabled={pending}>
                Odśwież
              </PillButton>
              <Button size="sm" onClick={() => setEditing('new')}>
                <Plus size={14} strokeWidth={2} />
                Nowa kolekcja
              </Button>
            </>
          }
        />
        <div className={cn('px-4 pt-3 pb-4 transition-opacity', pending && 'opacity-60')}>
          {loadError && <ErrorBox className="mb-3">{loadError}</ErrorBox>}
          {error && <ErrorBox className="mb-3">{error}</ErrorBox>}
          {drafts > 0 && (
            <NoticeBox className="mb-3">
              Szkice kolekcji (także utworzone automatycznie przy dodawaniu produktów) nie mają strony w sklepie, dopóki ich nie opublikujesz.
            </NoticeBox>
          )}

          {rows.length ? (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {rows.map((collection) => (
                <article key={collection.id} className="flex flex-col overflow-hidden rounded-md border border-border bg-surface shadow-1">
                  <button
                    type="button"
                    onClick={() => setEditing(collection)}
                    className="relative grid h-32 place-items-center bg-surface-muted text-left overflow-hidden"
                    aria-label={`Edytuj kolekcję ${collection.title}`}
                  >
                    {collection.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`${collection.imageUrl}?w=640&h=260&fit=crop`} alt={collection.imageAlt ?? ''} className="size-full object-cover" />
                    ) : (
                      <Layers size={22} strokeWidth={1.5} className="text-muted" />
                    )}
                    <span className="absolute top-2 left-2">
                      <Badge tone={toneFor(PUBLISH_TONES, collection.status)}>{PublishStateLabel[collection.status] ?? collection.status}</Badge>
                    </span>
                  </button>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <h3 className="m-0 truncate text-sm font-semibold text-text" title={collection.title}>{collection.title}</h3>
                    <p className="m-0 truncate font-mono text-[11px] text-text-2">
                      {collection.slug ? `/kolekcje/${collection.slug}` : 'brak adresu'}
                    </p>
                    <p className="m-0 text-xs text-text-2">
                      {collection.productCount} {productsLabel(collection.productCount)} w sklepie · zmiana {formatDateTime(collection.updatedAt)}
                    </p>
                    <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(collection)}>
                        <Pencil size={13} strokeWidth={1.5} />
                        Edytuj
                      </Button>
                      <Button size="sm" variant="secondary" disabled={busy === `publish-${collection.id}`} onClick={() => togglePublished(collection)}>
                        {collection.status === 'published' ? <EyeOff size={13} strokeWidth={1.5} /> : <Eye size={13} strokeWidth={1.5} />}
                        {collection.status === 'published' ? 'Wycofaj' : collection.status === 'changed' ? 'Opublikuj zmiany' : 'Opublikuj'}
                      </Button>
                      {collection.status !== 'draft' && collection.slug && (
                        <a
                          href={`/kolekcje/${collection.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1 rounded-xs px-2 text-xs font-medium text-text-2 hover:bg-surface-muted"
                        >
                          <ExternalLink size={13} strokeWidth={1.5} />
                          Sklep
                        </a>
                      )}
                      <Button size="sm" variant="danger" className="ml-auto" disabled={busy === `delete-${collection.id}`} onClick={() => remove(collection)}>
                        <Trash2 size={13} strokeWidth={1.5} />
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : !loadError ? (
            <EmptyState icon={<Layers size={20} strokeWidth={1.5} />} title={needle ? 'Brak wyników' : 'Brak kolekcji'}>
              {needle
                ? 'Żadna kolekcja nie pasuje do wyszukiwania.'
                : 'Utwórz pierwszą kolekcję albo wpisz jej nazwę przy dodawaniu produktu — powstanie jako szkic.'}
            </EmptyState>
          ) : null}
        </div>
      </Card>

      {editing && (
        <CollectionModal
          collection={editing === 'new' ? null : editing}
          catalog={catalog}
          onClose={() => setEditing(null)}
          onChanged={refresh}
        />
      )}
    </section>
  )
}
