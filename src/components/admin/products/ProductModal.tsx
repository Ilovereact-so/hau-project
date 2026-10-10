'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import toast from 'react-hot-toast'
import { ExternalLink, Save } from 'lucide-react'
import type { AdminProduct } from '@/lib/admin/catalog'
import { adminCreateProduct, adminUpdateProduct } from '@/actions/adminProducts'
import { Button } from '../kit/Button'
import { ErrorBox } from '../kit/EmptyState'
import { Modal } from '../kit/Modal'
import { SelectField, TextAreaField, TextField } from '../kit/TextField'
import { Toggle } from '../kit/Toggle'
import { CollectionPicker, type CollectionChoice, type CollectionSelection } from './CollectionPicker'
import { PriceHistoryPanel } from './PriceHistoryPanel'
import { ProductImagesManager } from './ProductImagesManager'
import { PromotionFields, promotionDraftFrom, promotionFromDraft, type PromotionDraft } from './PromotionFields'
import { RichTextEditor, type RichTextEditorHandle } from '../kit/RichTextEditor'

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
 * Dodawanie i edycja produktu w Sanity — najczęściej zmieniane pola,
 * promocja i oba opisy (krótki przy cenie, pełny pod zdjęciami).
 * Zdjęcia przypisuje się tu do wariantów. Filtry i warianty zostają w Studio (link na dole okna).
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
  const [promotion, setPromotion] = useState<PromotionDraft>(() => promotionDraftFrom(product?.promotion))
  const [promotionTouched, setPromotionTouched] = useState(false)
  // Długi opis żyje w stanie edytora — czytamy go dopiero przy zapisie
  // i wysyłamy tylko, gdy ktoś go ruszył (inaczej pole zostaje bez zmian).
  const descriptionRef = useRef<RichTextEditorHandle>(null)
  const [descriptionTouched, setDescriptionTouched] = useState(false)
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
  const markChanged = useCallback(() => setChanged(true), [])

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
      ...(promotionTouched ? { promotion: promotionFromDraft(promotion) } : {}),
      ...(descriptionTouched ? { description: descriptionRef.current?.getValue() ?? [] } : {}),
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
              hint="Cena regularna. Jej zmiana nie jest promocją — obniżkę ustaw w sekcji „Promocja”."
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
          <PromotionFields
            draft={promotion}
            regularPrice={(() => {
              const value = numberOrNull(price)
              return value !== null && Number.isFinite(value) && value > 0 ? value : null
            })()}
            onChange={(next) => {
              setPromotion(next)
              setPromotionTouched(true)
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
          <TextAreaField
            label="Krótki opis (przy cenie)"
            rows={4}
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            maxLength={2000}
            hint="2–4 zdania w zakładce „Opis” obok zdjęć — najważniejsze korzyści."
          />

          {isNew && (
            <p className="m-0 rounded-xs border border-dashed border-border-strong bg-bg px-3 py-4 text-center text-xs leading-[1.6] text-text-2">
              Zdjęcia dodasz po zapisaniu szkicu (albo zaimportujesz je paczką ZIP w „Import CSV”).
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-2">Opis produktu (pełny — pod zdjęciami, ważny dla SEO)</span>
        <RichTextEditor
          ref={descriptionRef}
          initialValue={product?.description ?? null}
          placeholder="Szczegółowy opis: zastosowanie, materiały, rozmiary, pielęgnacja… „## ” tworzy śródtytuł, „- ” listę."
          onEdit={() => setDescriptionTouched(true)}
        />
      </div>

      {product && (
        <ProductImagesManager
          product={product}
          alt={title || product.title}
          onChanged={markChanged}
          onError={setError}
          onBusyChange={setUploading}
        />
      )}

      {error && <ErrorBox>{error}</ErrorBox>}
    </Modal>
  )
}
