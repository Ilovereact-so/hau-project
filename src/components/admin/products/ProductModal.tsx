'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import toast from 'react-hot-toast'
import { ExternalLink, ImageOff, ImagePlus, Save, Star, Trash2 } from 'lucide-react'
import type { AdminProduct } from '@/lib/admin/catalog'
import {
  adminCreateProduct,
  adminMakeImagePrimary,
  adminRemoveProductImage,
  adminUpdateProduct,
  adminUploadProductImage,
} from '@/actions/adminProducts'
import { Button, IconButton } from '../kit/Button'
import { ErrorBox } from '../kit/EmptyState'
import { Modal } from '../kit/Modal'
import { SelectField, TextAreaField, TextField } from '../kit/TextField'
import { Toggle } from '../kit/Toggle'
import { cn } from '../kit/utils'
import { CollectionPicker, type CollectionChoice, type CollectionSelection } from './CollectionPicker'
import { PriceHistoryPanel } from './PriceHistoryPanel'

export type CategoryOptions = {
  categories: Array<{ id: string; title: string }>
  subcategories: Array<{ id: string; title: string; parentId: string | null }>
  collections: CollectionChoice[]
}

const numberOrNull = (value: string) => {
  const text = value.trim().replace(',', '.')
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

/**
 * Dodawanie i edycja produktu w Sanity — najczęściej zmieniane pola.
 * Opis, filtry i warianty zostają w Studio (link na dole okna).
 */
export function ProductModal({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: AdminProduct | null
  categories: CategoryOptions
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = !product
  const [title, setTitle] = useState(product?.title ?? '')
  const [subtitle, setSubtitle] = useState(product?.subtitle ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [brand, setBrand] = useState(product?.brand ?? '')
  const [price, setPrice] = useState(product?.price !== null && product?.price !== undefined ? String(product.price) : '')
  const [stock, setStock] = useState(product?.stock !== null && product?.stock !== undefined ? String(product.stock) : '')
  const [categoryId, setCategoryId] = useState(product?.category?.id ?? '')
  const [subcategoryId, setSubcategoryId] = useState(product?.subcategory?.id ?? '')
  const [intro, setIntro] = useState(product?.intro ?? '')
  const [shortDescription, setShortDescription] = useState(product?.shortDescription ?? '')
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false)
  const [isBestseller, setIsBestseller] = useState(product?.isBestseller ?? false)
  const [images, setImages] = useState(product?.images ?? [])
  // Tylko kolekcje znane z listy — wisząca referencja (kolekcja usunięta w Studio)
  // nie może zablokować zapisu produktu; zniknie przy pierwszej zmianie kolekcji.
  const [collections, setCollections] = useState<CollectionSelection>(() => ({
    ids: (product?.collectionIds ?? []).filter((id) => categories.collections.some((c) => c.id === id)),
    newNames: [],
  }))
  const [collectionsTouched, setCollectionsTouched] = useState(false)
  const [error, setError] = useState('')
  const [saving, startSaving] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [changed, setChanged] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  /* Podkategoria musi należeć do wybranej kategorii — po zmianie kategorii
     czyścimy niepasujący wybór zamiast zapisać niespójną parę. */
  useEffect(() => {
    if (!subcategoryId || !categoryId) return
    const sub = categories.subcategories.find((entry) => entry.id === subcategoryId)
    if (sub?.parentId && sub.parentId !== categoryId) setSubcategoryId('')
  }, [categoryId, subcategoryId, categories.subcategories])

  const subOptions = categories.subcategories.filter((sub) => !categoryId || !sub.parentId || sub.parentId === categoryId)
  const hasVariants = Boolean(product?.variants.length)

  const close = () => {
    if (changed) onSaved()
    onClose()
  }

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const priceValue = numberOrNull(price)
    const stockValue = numberOrNull(stock)
    if (priceValue === null || Number.isNaN(priceValue) || priceValue <= 0) {
      setError('Podaj poprawną cenę (większą od 0).')
      return
    }
    if (Number.isNaN(stockValue) || (stockValue !== null && (!Number.isInteger(stockValue) || stockValue < 0))) {
      setError('Stan magazynowy musi być liczbą całkowitą ≥ 0.')
      return
    }
    setError('')
    const input = {
      title,
      subtitle,
      sku,
      brand,
      price: priceValue,
      // compareAtPrice nie jest wysyłane — obniżki liczy rejestr cen.
      stock: stockValue,
      intro,
      shortDescription,
      categoryId: categoryId || null,
      subcategoryId: subcategoryId || null,
      isFeatured,
      isBestseller,
      // Niezmienione kolekcje nie są wysyłane — zapis nie ruszy pola `collections`.
      ...(collectionsTouched || (isNew && (collections.ids.length || collections.newNames.length))
        ? { collectionIds: collections.ids, newCollectionNames: collections.newNames }
        : {}),
    }
    startSaving(async () => {
      const result = product ? await adminUpdateProduct(product.id, input) : await adminCreateProduct(input)
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(product ? 'Produkt zapisany' : 'Produkt dodany jako szkic — opublikuj go, gdy będzie gotowy')
      if (collections.newNames.length) {
        toast(`Utworzono ${collections.newNames.length === 1 ? 'kolekcję' : 'kolekcje'} jako szkic: ${collections.newNames.join(', ')}`, { icon: '🗂️' })
      }
      onSaved()
      onClose()
    })
  }

  const upload = async (files: FileList | null) => {
    if (!product || !files?.length) return
    setUploading(true)
    setError('')
    try {
      for (const file of Array.from(files)) {
        const form = new FormData()
        form.set('productId', product.id)
        form.set('alt', title || product.title)
        form.set('file', file)
        const result = await adminUploadProductImage(form)
        if (!result.ok) {
          setError(result.error)
          break
        }
        setImages((current) => [...current, { key: result.data.key, url: result.data.url, alt: title }])
        setChanged(true)
      }
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removeImage = async (key: string) => {
    if (!product || !window.confirm('Usunąć to zdjęcie z produktu?')) return
    const result = await adminRemoveProductImage(product.id, key)
    if (!result.ok) return setError(result.error)
    setImages((current) => current.filter((image) => image.key !== key))
    setChanged(true)
  }

  const makePrimary = async (key: string) => {
    if (!product) return
    const result = await adminMakeImagePrimary(product.id, key)
    if (!result.ok) return setError(result.error)
    setImages((current) => {
      const picked = current.find((image) => image.key === key)
      return picked ? [picked, ...current.filter((image) => image.key !== key)] : current
    })
    setChanged(true)
  }

  return (
    <Modal
      as="form"
      onSubmit={submit}
      title={isNew ? 'Dodaj produkt' : `Edycja: ${product.title}`}
      subtitle={
        isNew
          ? 'Produkt powstaje jako szkic w Sanity — do sklepu trafi po kliknięciu „Opublikuj”. Zdjęcia dodasz po zapisaniu.'
          : 'Zmiany zapisują się w Sanity (także w szkicu, jeśli istnieje). Sklep odświeża katalog w ciągu minuty.'
      }
      width="w-[min(860px,100%)]"
      onClose={close}
      footer={
        <>
          {product && (
            <a
              href={`/studio/structure/product;${product.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mr-auto inline-flex items-center gap-1.5 self-center text-xs font-medium text-text-2 hover:text-text"
            >
              Pełna edycja w Sanity Studio <ExternalLink size={12} strokeWidth={1.5} />
            </a>
          )}
          <Button variant="secondary" onClick={close}>
            Anuluj
          </Button>
          <Button type="submit" disabled={saving || uploading}>
            <Save size={15} strokeWidth={1.5} />
            {saving ? 'Zapisywanie…' : isNew ? 'Dodaj szkic' : 'Zapisz zmiany'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <TextField label="Nazwa" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          <TextField label="Podtytuł" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={200} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="SKU" required value={sku} onChange={(e) => setSku(e.target.value)} className="font-mono" maxLength={64} hint="Unikalny — po nim działa import CSV." />
            <TextField label="Marka" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={128} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Cena (zł)"
              required
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="np. 49,99"
              hint="Obniżkę wystarczy wpisać jako nową cenę — sklep sam pokaże cenę sprzed obniżki."
            />
            <TextField
              label="Stan (szt.)"
              type="number"
              min="0"
              step="1"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              hint={hasVariants ? 'Stany wariantów — w tabeli katalogu.' : undefined}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Kategoria"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={[{ value: '', label: '— brak —' }, ...categories.categories.map((c) => ({ value: c.id, label: c.title }))]}
            />
            <SelectField
              label="Subkategoria"
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              options={[{ value: '', label: '— brak —' }, ...subOptions.map((s) => ({ value: s.id, label: s.title }))]}
            />
          </div>
          <CollectionPicker
            options={categories.collections}
            value={collections}
            disabled={saving}
            onChange={(next) => {
              setCollections(next)
              setCollectionsTouched(true)
            }}
          />
          {product && <PriceHistoryPanel product={product} />}
          <div className="flex flex-wrap gap-4 rounded-xs border border-border bg-surface-muted px-3 py-2.5">
            <label className="flex items-center gap-2 text-xs font-medium text-text-2">
              <Toggle checked={isFeatured} onChange={() => setIsFeatured((v) => !v)} label="Promowany" />
              Promowany
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-text-2">
              <Toggle checked={isBestseller} onChange={() => setIsBestseller((v) => !v)} label="Bestseller" />
              Bestseller
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <TextAreaField label="Intro (listing)" rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={1000} />
          <TextAreaField label="Krótki opis" rows={4} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} maxLength={2000} />

          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-text-2">Zdjęcia</span>
            {isNew ? (
              <p className="m-0 rounded-xs border border-dashed border-border-strong bg-bg px-3 py-4 text-center text-xs leading-[1.6] text-text-2">
                Zdjęcia dodasz po zapisaniu szkicu (albo zaimportujesz je paczką ZIP w „Import CSV”).
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {images.map((image, index) => (
                  <span
                    key={image.key}
                    className={cn(
                      'group relative grid size-20 place-items-center overflow-hidden rounded-xs border bg-surface-muted',
                      index === 0 ? 'border-primary/50' : 'border-border'
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${image.url}?w=160&h=160&fit=crop`} alt={image.alt ?? ''} className="size-full object-cover" />
                    {index === 0 && (
                      <span className="absolute top-1 left-1 rounded-full bg-primary px-1.5 py-px text-[9px] font-semibold text-white">główne</span>
                    )}
                    <span className="absolute inset-x-1 bottom-1 hidden justify-end gap-1 group-hover:flex group-focus-within:flex">
                      {index > 0 && (
                        <IconButton label="Ustaw jako główne" className="size-6" onClick={() => void makePrimary(image.key)}>
                          <Star size={12} strokeWidth={1.5} />
                        </IconButton>
                      )}
                      <IconButton label="Usuń zdjęcie" className="size-6 text-danger" onClick={() => void removeImage(image.key)}>
                        <Trash2 size={12} strokeWidth={1.5} />
                      </IconButton>
                    </span>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="grid size-20 place-items-center rounded-xs border border-dashed border-border-strong bg-bg text-text-2 transition-colors hover:text-text disabled:opacity-60"
                >
                  <span className="flex flex-col items-center gap-1 text-[10px] font-medium">
                    {uploading ? <ImageOff size={16} strokeWidth={1.5} /> : <ImagePlus size={16} strokeWidth={1.5} />}
                    {uploading ? 'Wysyłam…' : 'Dodaj'}
                  </span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => void upload(event.target.files)}
                />
              </div>
            )}
            {!isNew && <span className="text-[11px] text-text-2">Pierwsze zdjęcie jest miniaturą w sklepie. Maks. 10 MB na plik.</span>}
          </div>
        </div>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
    </Modal>
  )
}
