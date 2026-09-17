'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  Boxes, ChevronDown, ExternalLink, Eye, EyeOff, ImageOff, PackageOpen, Pencil, Plus, RefreshCw, Star, Trash2, Trophy,
} from 'lucide-react'
import type { AdminProduct } from '@/lib/admin/catalog'
import {
  adminDeleteProduct, adminRefreshProducts, adminSetPublished, adminToggleProductFlag,
} from '@/actions/adminProducts'
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

const LOW_STOCK = 10

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
          title={lowOnly ? 'Magazyn — niski stan' : 'Katalog produktów'}
          subtitle={`${products.length} pozycji · ${counts.published} w sklepie · ${counts.drafts} szkiców · ${counts.low} z niskim stanem`}
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
                {lowOnly ? 'Pokaż wszystkie' : `Niski stan (${counts.low})`}
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

          {filtered.length ? (
            <DataTable>
              <thead>
                <tr>
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
                      <Tr className={cn('cursor-pointer', isExpanded && 'bg-surface-muted/70')} onClick={() => setExpandedId(isExpanded ? null : product.id)}>
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
                            <span className="font-medium">{formatCurrencyPrecise(product.price)}</span>
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
                            {product.slug && product.status !== 'draft' && (
                              <a
                                href={`/product/${product.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Zobacz w sklepie"
                                title="Zobacz w sklepie"
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
                          <td colSpan={7} className="border-b border-border bg-surface-muted/60 p-0">
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
              {lowOnly ? 'Żaden produkt nie ma niskiego stanu — wszystkie warianty są powyżej progu 10 szt.' : 'Żaden produkt nie pasuje do filtrów.'}
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
