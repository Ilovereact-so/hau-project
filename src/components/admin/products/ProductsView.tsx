'use client'

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { LOW_STOCK_THRESHOLD } from '@/lib/stock'
import { describePromotion, promotionState, type ProductPromotion } from '@/lib/promotion'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  Boxes, ChevronDown, ExternalLink, Eye, EyeOff, ImageOff, PackageOpen, Pencil, Plus, RefreshCw, Star, Trash2, Trophy, X,
} from 'lucide-react'
import type { AdminProduct } from '@/lib/admin/catalog'
import {
  adminBulkProducts, adminDeleteProduct, adminRefreshProducts, adminSetPublished, adminToggleProductFlag,
} from '@/actions/adminProducts'
import type { BulkProductAction } from '@/lib/admin/catalog'
import { PublishStateLabel } from '@/lib/admin/labels'
import { Badge, Dot, PUBLISH_TONES, toneFor } from '../kit/Badge'
import { Button, IconButton } from '../kit/Button'
import { Card, CardHeader } from '../kit/Card'
import { DataTable, Td, Th, Tr } from '../kit/DataTable'
import { EmptyState, ErrorBox } from '../kit/EmptyState'
import { PillButton, PillSearch, PillSelect } from '../kit/Pill'
import { formatCurrencyPrecise } from '../kit/format'
import { cn } from '../kit/utils'
import { useQueryNav } from '../orders/useQueryNav'
import { ProductModal, type CategoryOptions } from './ProductModal'
import { VariantStockTable } from './VariantStockTable'

// Niski stan = 1 sztuka albo brak (lib/stock.ts).
const LOW_STOCK = LOW_STOCK_THRESHOLD

export function ProductsView({
  products,
  categories,
  loadError,
}: {
  products: AdminProduct[]
  categories: CategoryOptions
  loadError?: string
}) {
  const router = useRouter()
  const nav = useQueryNav()
  const [, startTransition] = useTransition()
  const query = nav.get('q')
  const lowOnly = nav.get('filter') === 'low'
  const statusFilter = nav.get('status')
  const categoryFilter = nav.get('category')
  const collectionFilter = nav.get('collection')

  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(lowOnly ? '__low' : null)
  const [editing, setEditing] = useState<AdminProduct | 'new' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  // Zaznaczenie do akcji hurtowych — id produktów (przeżywa zmianę filtrów).
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState<BulkProductAction | null>(null)

  const needle = (search || query).trim().toLowerCase()
  const filtered = useMemo(
    () =>
      products.filter((product) => {
        if (lowOnly && !product.lowStock.length) return false
        if (statusFilter && (statusFilter === 'draft' ? product.status !== 'draft' : product.status === 'draft')) return false
        if (categoryFilter && product.category?.id !== categoryFilter && product.subcategory?.id !== categoryFilter) return false
        if (collectionFilter && !product.collectionIds.includes(collectionFilter)) return false
        if (!needle) return true
        return `${product.title} ${product.sku ?? ''} ${product.brand ?? ''} ${product.slug ?? ''} ${product.variants.map((v) => v.sku).join(' ')}`
          .toLowerCase()
          .includes(needle)
      }),
    [products, lowOnly, statusFilter, categoryFilter, collectionFilter, needle]
  )

  const counts = useMemo(
    () => ({
      published: products.filter((p) => p.status !== 'draft').length,
      drafts: products.filter((p) => p.status === 'draft').length,
      low: products.filter((p) => p.lowStock.length).length,
    }),
    [products]
  )

  // Po odświeżeniu listy (np. usunięcie) zaznaczenie nie może wskazywać nieistniejących produktów.
  useEffect(() => {
    setSelected((current) => {
      const ids = new Set(products.map((p) => p.id))
      const next = new Set([...current].filter((id) => ids.has(id)))
      return next.size === current.size ? current : next
    })
  }, [products])

  const filteredIds = useMemo(() => filtered.map((p) => p.id), [filtered])
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id))
  const someFilteredSelected = filteredIds.some((id) => selected.has(id))
  const toggleAll = () =>
    setSelected((current) => {
      const next = new Set(current)
      if (allFilteredSelected) filteredIds.forEach((id) => next.delete(id))
      else filteredIds.forEach((id) => next.add(id))
      return next
    })
  const toggleOne = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const selectedProducts = useMemo(() => products.filter((p) => selected.has(p.id)), [products, selected])
  const draftProducts = useMemo(() => products.filter((p) => p.status === 'draft'), [products])

  const runBulk = async (action: BulkProductAction, targets: AdminProduct[]) => {
    if (!targets.length) return
    const n = targets.length
    const label = `${n} ${n === 1 ? 'produkt' : n < 5 ? 'produkty' : 'produktów'}`
    if (action === 'unpublish' && !window.confirm(`Wycofać ze sklepu ${label}?\n\nWrócą do szkiców — klienci przestaną je widzieć.`)) return
    if (action === 'delete' && !window.confirm(`Usunąć TRWALE ${label}?\n\nZnikną z Sanity razem ze szkicami. Historia zamówień zostaje.`)) return
    if (action === 'publish') {
      const noImage = targets.filter((p) => !p.images.length).length
      if (noImage && !window.confirm(`${noImage} z zaznaczonych nie ma zdjęcia. Opublikować mimo to?`)) return
    }
    setBulkBusy(action)
    setError('')
    const result = await adminBulkProducts(targets.map((p) => p.id), action)
    setBulkBusy(null)
    if (!result.ok) {
      setError(result.error)
      return
    }
    const { done, failed } = result.data
    if (done.length) toast.success(`${BULK_DONE[action]}: ${done.length}`)
    if (failed.length) {
      setError(
        `Nie udało się dla ${failed.length}: ` +
          failed.slice(0, 8).map((f) => `„${f.title}” (${f.error})`).join(', ') +
          (failed.length > 8 ? ` i ${failed.length - 8} więcej` : ''),
      )
    }
    // Zostają zaznaczone tylko te, którym się nie udało — łatwo poprawić i ponowić.
    setSelected(new Set(failed.map((f) => f.id)))
    startTransition(() => router.refresh())
  }

  const act = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(key)
    setError('')
    const result = await fn()
    setBusy(null)
    if (!result.ok) {
      setError(result.error ?? 'Operacja nie powiodła się.')
      return false
    }
    toast.success(success)
    startTransition(() => router.refresh())
    return true
  }

  const togglePublished = (product: AdminProduct) => {
    const publish = product.status === 'draft' || product.status === 'changed'
    if (product.status === 'changed') {
      if (!window.confirm(`„${product.title}” ma niezapisane w sklepie zmiany ze Studio.\n\nOpublikować je teraz?`)) return
    } else if (!publish) {
      if (!window.confirm(`Wycofać „${product.title}” ze sklepu?\n\nProdukt wróci do szkicu — klienci przestaną go widzieć, a koszyki z nim nie przejdą przez checkout.`)) return
    } else if (!product.images.length) {
      if (!window.confirm(`„${product.title}” nie ma zdjęcia. Opublikować mimo to?`)) return
    }
    if (publish && !product.price) {
      setError(`„${product.title}” nie ma ceny — uzupełnij ją przed publikacją.`)
      return
    }
    void act(`publish-${product.id}`, () => adminSetPublished(product.id, publish), publish ? 'Opublikowano w sklepie' : 'Wycofano do szkicu')
  }

  const unpublish = (product: AdminProduct) => {
    if (!window.confirm(`Wycofać „${product.title}” ze sklepu?\n\nProdukt wróci do szkicu (zmiany ze Studio zostaną zachowane w szkicu).`)) return
    void act(`publish-${product.id}`, () => adminSetPublished(product.id, false), 'Wycofano do szkicu')
  }

  const remove = (product: AdminProduct) => {
    const confirmed = window.confirm(
      `Usunąć trwale „${product.title}”${product.sku ? ` (${product.sku})` : ''}?\n\n` +
        'Znika z Sanity razem ze szkicem. Historia zamówień zostaje (ceny i nazwy są zapisane w zamówieniach).\n\n' +
        'Jeśli chcesz tylko ukryć produkt, użyj „Wycofaj”.'
    )
    if (!confirmed) return
    void act(`delete-${product.id}`, () => adminDeleteProduct(product.id), 'Produkt usunięty').then((ok) => {
      if (ok && expandedId === product.id) setExpandedId(null)
    })
  }

  const toggleFlag = (product: AdminProduct, field: 'isFeatured' | 'isBestseller') =>
    void act(`${field}-${product.id}`, () => adminToggleProductFlag(product.id, field, !product[field]), 'Zapisano')

  const refresh = () =>
    void act('refresh', adminRefreshProducts, 'Katalog odświeżony z Sanity')

  const categoryOptions = [
    { value: '', label: 'Wszystkie kategorie' },
    ...categories.categories.flatMap((category) => [
      { value: category.id, label: category.title },
      ...categories.subcategories
        .filter((sub) => sub.parentId === category.id)
        .map((sub) => ({ value: sub.id, label: `  └ ${sub.title}` })),
    ]),
  ]

  return (
    <section className="flex flex-col gap-4 animate-fade-in">
      <Card className="flex flex-col">
        <CardHeader
          icon={lowOnly ? Boxes : PackageOpen}
          title={lowOnly ? 'Magazyn — 1 sztuka lub brak' : 'Katalog produktów'}
          subtitle={`${products.length} pozycji · ${counts.published} w sklepie · ${counts.drafts} szkiców · ${counts.low} z 1 szt. lub bez towaru`}
          actions={
            <>
              <PillSearch value={search} onChange={setSearch} placeholder="Szukaj produktu, SKU…" />
              <PillSelect
                label="Publikacja"
                value={statusFilter}
                onChange={(value) => nav.set({ status: value })}
                options={[
                  { value: '', label: 'Wszystkie' },
                  { value: 'published', label: 'W sklepie' },
                  { value: 'draft', label: 'Szkice' },
                ]}
              />
              <PillSelect label="Kategoria" value={categoryFilter} onChange={(value) => nav.set({ category: value })} options={categoryOptions} />
              {categories.collections.length > 0 && (
                <PillSelect
                  label="Kolekcja"
                  value={collectionFilter}
                  onChange={(value) => nav.set({ collection: value })}
                  options={[
                    { value: '', label: 'Wszystkie kolekcje' },
                    ...categories.collections.map((c) => ({ value: c.id, label: c.status === 'draft' ? `${c.title} (szkic)` : c.title })),
                  ]}
                />
              )}
              <PillButton icon={Boxes} active={lowOnly} onClick={() => nav.set({ filter: lowOnly ? null : 'low' })}>
                {lowOnly ? 'Pokaż wszystkie' : `1 szt. lub brak (${counts.low})`}
              </PillButton>
              <PillButton icon={RefreshCw} onClick={refresh} disabled={busy === 'refresh'}>
                Odśwież
              </PillButton>
              <Button size="sm" onClick={() => setEditing('new')}>
                <Plus size={14} strokeWidth={2} />
                Dodaj produkt
              </Button>
            </>
          }
        />

        <div className="px-4 pt-3 pb-4">
          {loadError && <ErrorBox className="mb-3">{loadError}</ErrorBox>}
          {error && <ErrorBox className="mb-3">{error}</ErrorBox>}
          {query && !search && (
            <p className="mt-0 mb-3 text-xs text-text-2">
              Filtr z wyszukiwarki: „<b className="text-text">{query}</b>”.{' '}
              <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => nav.set({ q: null })}>
                Wyczyść
              </button>
            </p>
          )}

          {draftProducts.length > 0 && statusFilter !== 'draft' && !lowOnly && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xs border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-text-2">
              <EyeOff size={14} strokeWidth={1.5} className="text-primary" />
              <span>
                <b className="text-text">{draftProducts.length}</b> {draftProducts.length === 1 ? 'produkt czeka' : 'produktów czeka'} w szkicach
                (np. z importu) — klienci ich nie widzą.
              </span>
              <span className="ml-auto flex gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => nav.set({ status: 'draft' })}>
                  Pokaż szkice
                </Button>
                <Button size="sm" disabled={Boolean(bulkBusy)} onClick={() => void runBulk('publish', draftProducts)}>
                  <Eye size={14} strokeWidth={1.5} />
                  Opublikuj wszystkie ({draftProducts.length})
                </Button>
              </span>
            </div>
          )}

          {selected.size > 0 && (
            <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-1.5 rounded-xs border border-border-strong bg-surface px-3 py-2 shadow-1">
              <strong className="mr-1 text-xs text-text">Zaznaczone: {selected.size}</strong>
              <Button size="sm" disabled={Boolean(bulkBusy)} onClick={() => void runBulk('publish', selectedProducts)}>
                <Eye size={14} strokeWidth={1.5} />
                {bulkBusy === 'publish' ? 'Publikuję…' : 'Opublikuj'}
              </Button>
              <Button size="sm" variant="secondary" disabled={Boolean(bulkBusy)} onClick={() => void runBulk('unpublish', selectedProducts)}>
                <EyeOff size={14} strokeWidth={1.5} />
                Wycofaj
              </Button>
              <span className="mx-1 h-5 w-px bg-border" aria-hidden />
              <Button size="sm" variant="secondary" disabled={Boolean(bulkBusy)} onClick={() => void runBulk('feature', selectedProducts)}>
                <Star size={14} strokeWidth={1.5} />
                Promuj
              </Button>
              <Button size="sm" variant="ghost" disabled={Boolean(bulkBusy)} onClick={() => void runBulk('unfeature', selectedProducts)}>
                Bez promowania
              </Button>
              <Button size="sm" variant="secondary" disabled={Boolean(bulkBusy)} onClick={() => void runBulk('bestseller', selectedProducts)}>
                <Trophy size={14} strokeWidth={1.5} />
                Bestseller
              </Button>
              <Button size="sm" variant="ghost" disabled={Boolean(bulkBusy)} onClick={() => void runBulk('unbestseller', selectedProducts)}>
                Bez bestsellera
              </Button>
              <span className="mx-1 h-5 w-px bg-border" aria-hidden />
              <Button size="sm" variant="danger" disabled={Boolean(bulkBusy)} onClick={() => void runBulk('delete', selectedProducts)}>
                <Trash2 size={14} strokeWidth={1.5} />
                Usuń
              </Button>
              <IconButton label="Odznacz wszystkie" className="ml-auto size-7" onClick={() => setSelected(new Set())}>
                <X size={14} strokeWidth={1.5} />
              </IconButton>
            </div>
          )}

          {filtered.length ? (
            <DataTable>
              <thead>
                <tr>
                  <Th className="w-9">
                    <SelectBox
                      checked={allFilteredSelected}
                      indeterminate={!allFilteredSelected && someFilteredSelected}
                      label={allFilteredSelected ? 'Odznacz widoczne' : `Zaznacz widoczne (${filteredIds.length})`}
                      onChange={toggleAll}
                    />
                  </Th>
                  <Th>Produkt</Th>
                  <Th>Status</Th>
                  <Th>W sklepie</Th>
                  <Th className="text-right">Cena</Th>
                  <Th>Magazyn</Th>
                  <Th>Wyróżnienia</Th>
                  <Th>Akcje</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => {
                  const isExpanded = expandedId === product.id || (expandedId === '__low' && lowOnly)
                  const low = product.lowStock.length > 0
                  return (
                    <Fragment key={product.id}>
                      <Tr
                        className={cn('cursor-pointer', isExpanded && 'bg-surface-muted/70', selected.has(product.id) && 'bg-primary/5')}
                        onClick={() => setExpandedId(isExpanded ? null : product.id)}
                      >
                        <Td className="w-9" onClick={(event) => event.stopPropagation()}>
                          <SelectBox checked={selected.has(product.id)} label={`Zaznacz „${product.title}”`} onChange={() => toggleOne(product.id)} />
                        </Td>
                        <Td className="min-w-[220px]">
                          <span className="flex items-center gap-3">
                            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xs border border-border bg-surface-muted text-muted">
                              {product.images[0] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={`${product.images[0].url}?w=80&h=80&fit=crop`} alt="" className="size-full object-cover" loading="lazy" />
                              ) : (
                                <ImageOff size={14} strokeWidth={1.5} />
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-2">
                                <Dot tone={toneFor(PUBLISH_TONES, product.status)} />
                                <strong className="truncate font-medium text-text">{product.title}</strong>
                              </span>
                              <span className="mt-0.5 block truncate text-[11px] text-text-2">
                                {[product.sku && `SKU ${product.sku}`, product.subcategory?.title ?? product.category?.title, product.brand]
                                  .filter(Boolean)
                                  .join(' · ') || '—'}
                              </span>
                            </span>
                          </span>
                        </Td>
                        <Td>
                          <Badge tone={toneFor(PUBLISH_TONES, product.status)}>{PublishStateLabel[product.status]}</Badge>
                        </Td>
                        <Td>
                          <div className="flex flex-nowrap items-center gap-1.5">
                            {product.status === 'published' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy === `publish-${product.id}`}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  togglePublished(product)
                                }}
                              >
                                <EyeOff size={14} strokeWidth={1.5} />
                                Wycofaj
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                disabled={busy === `publish-${product.id}`}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  togglePublished(product)
                                }}
                              >
                                <Eye size={14} strokeWidth={1.5} />
                                {product.status === 'changed' ? 'Opublikuj zmiany' : 'Opublikuj'}
                              </Button>
                            )}
                            {product.status === 'changed' && (
                              <IconButton
                                label="Wycofaj ze sklepu"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  unpublish(product)
                                }}
                              >
                                <EyeOff size={14} strokeWidth={1.5} />
                              </IconButton>
                            )}
                          </div>
                        </Td>
                        <Td className="text-right whitespace-nowrap">
                          {product.price !== null ? (
                            <span className="flex flex-col items-end">
                              <span className="font-medium">{formatCurrencyPrecise(product.price)}</span>
                              <PromotionTag promotion={product.promotion} />
                            </span>
                          ) : (
                            <span className="text-danger">brak ceny</span>
                          )}
                        </Td>
                        <Td>
                          <button
                            type="button"
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-xs border px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors',
                              low ? 'border-danger/30 bg-danger/10 text-danger' : 'border-border bg-surface text-text-2 hover:text-text'
                            )}
                            aria-expanded={isExpanded}
                            onClick={(event) => {
                              event.stopPropagation()
                              setExpandedId(isExpanded ? null : product.id)
                            }}
                          >
                            {product.totalStock === null ? 'nie śledzony' : `${product.totalStock} szt.`}
                            {product.variants.length > 0 && <span className="text-text-2">· {product.variants.length} war.</span>}
                            <ChevronDown size={12} strokeWidth={1.5} className={cn('transition-transform', isExpanded && 'rotate-180')} />
                          </button>
                        </Td>
                        <Td>
                          <div className="flex gap-1.5">
                            <FlagButton
                              active={product.isFeatured}
                              label="Promowany"
                              icon={Star}
                              disabled={busy === `isFeatured-${product.id}`}
                              onClick={() => toggleFlag(product, 'isFeatured')}
                            />
                            <FlagButton
                              active={product.isBestseller}
                              label="Bestseller"
                              icon={Trophy}
                              disabled={busy === `isBestseller-${product.id}`}
                              onClick={() => toggleFlag(product, 'isBestseller')}
                            />
                          </div>
                        </Td>
                        <Td>
                          <div className="flex gap-1.5" onClick={(event) => event.stopPropagation()}>
                            <IconButton label="Edytuj produkt" onClick={() => setEditing(product)}>
                              <Pencil size={14} strokeWidth={1.5} />
                            </IconButton>
                            {product.slug && (
                              <a
                                href={`/product/${product.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={product.status === 'draft' ? 'Podgląd szkicu (widzi go tylko admin)' : 'Zobacz w sklepie'}
                                title={product.status === 'draft' ? 'Podgląd szkicu (widzi go tylko admin)' : 'Zobacz w sklepie'}
                                className="grid size-8 place-items-center rounded-xs border border-border bg-bg text-text-2 transition-colors hover:border-border-strong hover:text-text"
                              >
                                <ExternalLink size={14} strokeWidth={1.5} />
                              </a>
                            )}
                            <IconButton
                              label="Usuń produkt"
                              className="text-danger hover:border-danger/50 hover:text-danger"
                              disabled={busy === `delete-${product.id}`}
                              onClick={() => remove(product)}
                            >
                              <Trash2 size={14} strokeWidth={1.5} />
                            </IconButton>
                          </div>
                        </Td>
                      </Tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="border-b border-border bg-surface-muted/60 p-0">
                            <VariantStockTable product={product} threshold={LOW_STOCK} onError={setError} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </DataTable>
          ) : products.length ? (
            <EmptyState icon={<PackageOpen size={20} strokeWidth={1.5} />} title="Brak wyników">
              {lowOnly ? 'Żaden produkt nie ma niskiego stanu — nie ma wariantów z 1 sztuką ani bez towaru.' : 'Żaden produkt nie pasuje do filtrów.'}
            </EmptyState>
          ) : (
            <EmptyState icon={<PackageOpen size={20} strokeWidth={1.5} />} title="Brak produktów">
              Dodaj pierwszy produkt przyciskiem „Dodaj produkt” albo zaimportuj katalog z pliku CSV.
            </EmptyState>
          )}
        </div>
      </Card>

      {editing && (
        <ProductModal
          product={editing === 'new' ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => startTransition(() => router.refresh())}
        />
      )}
    </section>
  )
}

function FlagButton({
  active,
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  active: boolean
  label: string
  icon: typeof Star
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={active ? `${label} — kliknij, aby wyłączyć` : `Oznacz: ${label}`}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        'inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-full border px-2 text-[11px] font-medium whitespace-nowrap transition-colors duration-150 ease-(--ease) disabled:opacity-50',
        active ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-surface text-text-2 hover:text-text'
      )}
    >
      <Icon size={12} strokeWidth={1.8} />
      <span className="hidden 3xl:inline">{label}</span>
    </button>
  )
}

const BULK_DONE: Record<BulkProductAction, string> = {
  publish: 'Opublikowano',
  unpublish: 'Wycofano do szkiców',
  feature: 'Oznaczono jako promowane',
  unfeature: 'Zdjęto promowanie',
  bestseller: 'Oznaczono jako bestseller',
  unbestseller: 'Zdjęto bestseller',
  delete: 'Usunięto',
}

function SelectBox({
  checked,
  indeterminate,
  label,
  onChange,
}: {
  checked: boolean
  indeterminate?: boolean
  label: string
  onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate)
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      title={label}
      className="size-4 cursor-pointer accent-[var(--adm-primary,#ec3013)]"
    />
  )
}

/** Mała etykieta promocji pod ceną w katalogu (trwa / zaplanowana). */
function PromotionTag({ promotion }: { promotion: ProductPromotion | null }) {
  const state = promotionState(promotion)
  if (state !== 'active' && state !== 'scheduled') return null
  return (
    <span className={cn('text-[10px] font-semibold', state === 'active' ? 'text-success' : 'text-text-2')}>
      {state === 'active' ? 'promocja' : 'zaplanowana'} {describePromotion(promotion)}
    </span>
  )
}
