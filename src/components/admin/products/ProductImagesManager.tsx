'use client'

import { uploadAdminImage } from '@/lib/adminImageUpload'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Check, ImagePlus, Loader2, Star, Trash2, X } from 'lucide-react'
import type { AdminProduct, AdminProductImage } from '@/lib/admin/catalog'
import {
  adminMakeImagePrimary,
  adminRemoveProductImage,
  adminSetImagesVariants,
} from '@/actions/adminProducts'
import { matchFileToProduct, variantKeysForValues } from '@/lib/variantImages'
import { prepareImageForUpload } from '@/lib/imageUpload'
import { Button, IconButton } from '../kit/Button'
import { cn } from '../kit/utils'

/*
 * Zdjęcia produktu i ich przypisanie do wariantów.
 *
 * Przepływ „najmniej klikania”:
 * 1) wrzuć wszystkie zdjęcia naraz (przeciągnij albo „Dodaj”) — pliki
 *    nazwane jak `slug-mint.jpg` / `SKU-mint-m-2.jpg` przypisują się same,
 * 2) zaznacz jedno lub kilka zdjęć i kliknij wartość opcji („Kolor: mint”)
 *    albo konkretne warianty. Nic nie zaznaczone = zdjęcie wspólne.
 * Przypisania zapisują się same (zbiorczo, po chwili bezczynności).
 */

type Props = {
  product: AdminProduct
  alt: string
  onChanged: () => void
  onError: (message: string) => void
  onBusyChange?: (busy: boolean) => void
}

type Progress = { done: number; total: number } | null

const SAVE_DELAY = 700

export function ProductImagesManager({ product, alt, onChanged, onError, onBusyChange }: Props) {
  const [images, setImages] = useState<AdminProductImage[]>(product.images)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<Progress>(null)
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const pending = useRef<Map<string, string[]>>(new Map())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Callbacki rodzica przez ref — inaczej każdy render okna tworzyłby nowy
  // `flush`, a efekt sprzątający wysyłałby zapis przy każdym kliknięciu.
  const callbacks = useRef({ onChanged, onError })
  callbacks.current = { onChanged, onError }

  const variants = product.variants
  const variantKeys = useMemo(() => variants.map((v) => v.key), [variants])

  // Grupy skrótów: opcja (Kolor) → wartości (mint, beige) → warianty.
  const groups = useMemo(() => {
    const byOption = new Map<string, { label: string; values: Map<string, { label: string; keys: string[] }> }>()
    for (const variant of variants) {
      for (const option of variant.options) {
        const group = byOption.get(option.key) ?? { label: option.label, values: new Map() }
        const value = group.values.get(option.slug) ?? { label: option.value, keys: [] }
        value.keys.push(variant.key)
        group.values.set(option.slug, value)
        byOption.set(option.key, group)
      }
    }
    // Opcja z jedną wartością nic nie rozróżnia — pomijamy.
    return [...byOption.entries()].filter(([, group]) => group.values.size > 1)
  }, [variants])

  const busy = Boolean(progress) || saving
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange])

  // ─── zapis przypisań (zbiorczo) ────────────────────────────────────────────
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const updates = [...pending.current.entries()].map(([imageKey, keys]) => ({ imageKey, variantKeys: keys }))
    pending.current.clear()
    if (!updates.length) return
    setSaving(true)
    const result = await adminSetImagesVariants(product.id, updates)
    setSaving(false)
    if (!result.ok) {
      callbacks.current.onError(result.error)
      return
    }
    callbacks.current.onChanged()
  }, [product.id])

  // Zamknięcie okna nie może zgubić ostatnich kliknięć.
  useEffect(() => () => void flush(), [flush])

  const assign = (imageKeys: string[], compute: (current: string[]) => string[]) => {
    setImages((current) =>
      current.map((image) => {
        if (!imageKeys.includes(image.key)) return image
        // Kolejność kluczy jak w produkcie — stabilny zapis, czytelny diff.
        const next = variantKeys.filter((key) => compute(image.variantKeys).includes(key))
        pending.current.set(image.key, next)
        return { ...image, variantKeys: next }
      }),
    )
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), SAVE_DELAY)
  }

  const selectedImages = images.filter((image) => selected.has(image.key))
  const coverage = (keys: string[]): 'all' | 'some' | 'none' => {
    if (!selectedImages.length) return 'none'
    let hits = 0
    for (const image of selectedImages) if (keys.every((key) => image.variantKeys.includes(key))) hits += 1
    return hits === selectedImages.length ? 'all' : hits ? 'some' : 'none'
  }
  const toggleKeys = (keys: string[]) => {
    if (!selectedImages.length) return
    const remove = coverage(keys) === 'all'
    assign(
      selectedImages.map((image) => image.key),
      (current) => (remove ? current.filter((key) => !keys.includes(key)) : [...current, ...keys]),
    )
  }

  // ─── wgrywanie ─────────────────────────────────────────────────────────────
  const knownValues = useMemo(() => variants.flatMap((v) => v.options.map((o) => o.slug)), [variants])
  // Ten sam kształt co warianty ze sklepu — wspólna logika dopasowania nazw plików.
  const variantLikes = useMemo(
    () =>
      variants.map((v) => ({
        _key: v.key,
        optionValues: v.options.map((o) => ({ name: { key: o.key }, value: { slug: { current: o.slug } } })),
      })),
    [variants],
  )
  const upload = async (list: FileList | File[] | null) => {
    const files = Array.from(list ?? []).filter((file) => file.type.startsWith('image/'))
    if (!files.length) return
    // Kolejność jak w nazwach (slug-1, slug-2…), żeby zdjęcia nie mieszały się przy wysyłce równoległej.
    files.sort((a, b) => a.name.localeCompare(b.name, 'pl', { numeric: true }))
    setProgress({ done: 0, total: files.length })
    let auto = 0
    const added: AdminProductImage[] = []
    for (const [index, original] of files.entries()) {
      try {
        const file = await prepareImageForUpload(original)
        const match = matchFileToProduct(original.name, [product.slug ?? '', product.sku ?? ''], knownValues)
        const keys = match ? variantKeysForValues(variantLikes, match.values) : []
        const result = await uploadAdminImage<{ key: string; url: string; variantKeys: string[] }>({
          target: 'product',
          id: product.id,
          alt: alt || product.title,
          file,
          variantKeys: keys,
        })
        if (!result.ok) {
          onError(`${original.name}: ${result.error}`)
          continue
        }
        if (result.data.variantKeys.length) auto += 1
        const image = { key: result.data.key, url: result.data.url, alt: alt || null, variantKeys: result.data.variantKeys }
        added.push(image)
        setImages((current) => [...current, image])
      } catch (err) {
        console.error('[product images] upload', err)
        onError(`${original.name}: nie udało się wysłać (błąd serwera albo sieci).`)
      } finally {
        setProgress({ done: index + 1, total: files.length })
      }
    }
    setProgress(null)
    if (fileRef.current) fileRef.current.value = ''
    if (added.length) {
      onChanged()
      toast.success(
        auto
          ? `Dodano ${added.length} zdjęć — ${auto} przypisano do wariantów po nazwie pliku`
          : `Dodano ${added.length} zdjęć`,
      )
      // Świeżo dodane zostają zaznaczone — od razu można je przypisać.
      if (variants.length) setSelected(new Set(added.filter((image) => !image.variantKeys.length).map((image) => image.key)))
    }
  }

  const remove = async (key: string) => {
    if (!window.confirm('Usunąć to zdjęcie z produktu?')) return
    await flush()
    const result = await adminRemoveProductImage(product.id, key)
    if (!result.ok) return onError(result.error)
    setImages((current) => current.filter((image) => image.key !== key))
    setSelected((current) => {
      const next = new Set(current)
      next.delete(key)
      return next
    })
    onChanged()
  }

  const makePrimary = async (key: string) => {
    await flush()
    const result = await adminMakeImagePrimary(product.id, key)
    if (!result.ok) return onError(result.error)
    setImages((current) => {
      const picked = current.find((image) => image.key === key)
      return picked ? [picked, ...current.filter((image) => image.key !== key)] : current
    })
    onChanged()
  }

  const toggleSelect = (key: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const variantLabel = (key: string) => variants.find((v) => v.key === key)?.label ?? 'wariant'
  const ownCount = (key: string) => images.filter((image) => image.variantKeys.includes(key)).length
  const anyAssigned = images.some((image) => image.variantKeys.length)

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-2">
          Zdjęcia{variants.length ? ' i warianty' : ''}
          {saving && <span className="ml-2 text-[11px] font-normal text-text-2">zapisuję…</span>}
        </span>
        {variants.length > 0 && images.length > 0 && (
          <span className="flex items-center gap-2 text-[11px] text-text-2">
            {selected.size ? `Zaznaczone: ${selected.size}` : 'Kliknij zdjęcia, żeby je przypisać'}
            {selected.size < images.length && (
              <button type="button" className="font-medium text-text hover:underline" onClick={() => setSelected(new Set(images.map((i) => i.key)))}>
                zaznacz wszystkie
              </button>
            )}
            {selected.size > 0 && (
              <button type="button" className="font-medium text-text hover:underline" onClick={() => setSelected(new Set())}>
                odznacz
              </button>
            )}
          </span>
        )}
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          void upload(event.dataTransfer.files)
        }}
        className={cn('flex flex-wrap gap-2 rounded-xs p-1 transition-colors', dragOver && 'bg-primary/5 outline outline-dashed outline-primary/50')}
      >
        {images.map((image, index) => {
          const isSelected = selected.has(image.key)
          return (
            <div
              key={image.key}
              className={cn(
                'group relative size-24 overflow-hidden rounded-xs border bg-surface-muted',
                isSelected ? 'border-primary ring-2 ring-primary/40' : index === 0 ? 'border-primary/50' : 'border-border',
              )}
            >
              <button
                type="button"
                onClick={() => variants.length && toggleSelect(image.key)}
                className={cn('block size-full', variants.length ? 'cursor-pointer' : 'cursor-default')}
                aria-pressed={variants.length ? isSelected : undefined}
                aria-label={variants.length ? `Zaznacz zdjęcie ${index + 1}` : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${image.url}?w=192&h=192&fit=crop`} alt={image.alt ?? ''} className="size-full object-cover" />
              </button>
              {index === 0 && (
                <span className="pointer-events-none absolute top-1 left-1 rounded-full bg-primary px-1.5 py-px text-[9px] font-semibold text-white">główne</span>
              )}
              {isSelected && (
                <span className="pointer-events-none absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-primary text-white">
                  <Check size={12} strokeWidth={2.5} />
                </span>
              )}
              {variants.length > 0 && (() => {
                const live = image.variantKeys.filter((key) => variantKeys.includes(key))
                const orphan = image.variantKeys.length > 0 && !live.length
                return (
                  <span
                    className={cn(
                      'pointer-events-none absolute inset-x-0 bottom-0 truncate px-1.5 py-0.5 text-[9px] font-medium',
                      orphan ? 'bg-danger text-white' : live.length ? 'bg-black/65 text-white' : 'bg-white/85 text-text-2',
                    )}
                    title={orphan ? 'Wariantów tego zdjęcia już nie ma — sklep go nie pokazuje' : live.map(variantLabel).join(', ')}
                  >
                    {orphan
                      ? 'ukryte — brak wariantu'
                      : live.length === 0
                        ? 'wspólne'
                        : live.length === 1
                          ? variantLabel(live[0])
                          : `${live.length} wariantów`}
                  </span>
                )
              })()}
              <span className="absolute top-6 right-1 hidden flex-col gap-1 group-hover:flex group-focus-within:flex">
                {index > 0 && (
                  <IconButton label="Ustaw jako główne" className="size-6" onClick={() => void makePrimary(image.key)}>
                    <Star size={12} strokeWidth={1.5} />
                  </IconButton>
                )}
                <IconButton label="Usuń zdjęcie" className="size-6 text-danger" onClick={() => void remove(image.key)}>
                  <Trash2 size={12} strokeWidth={1.5} />
                </IconButton>
              </span>
            </div>
          )
        })}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={Boolean(progress)}
          className="grid size-24 place-items-center rounded-xs border border-dashed border-border-strong bg-bg text-text-2 transition-colors hover:text-text disabled:opacity-60"
        >
          <span className="flex flex-col items-center gap-1 px-1 text-center text-[10px] font-medium">
            {progress ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} strokeWidth={1.5} />}
            {progress ? `${progress.done}/${progress.total}` : 'Dodaj lub upuść'}
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

      {variants.length > 0 && selectedImages.length > 0 && (
        <div className="grid gap-2.5 rounded-xs border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-xs text-text">
              Przypisz {selectedImages.length === 1 ? 'zaznaczone zdjęcie' : `${selectedImages.length} zaznaczone zdjęcia`} do:
            </strong>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => assign(selectedImages.map((image) => image.key), () => [])}
                title="Zdjęcie pokaże się przy każdym wariancie"
              >
                Ustaw jako wspólne
              </Button>
              <IconButton label="Zamknij" className="size-7" onClick={() => setSelected(new Set())}>
                <X size={14} strokeWidth={1.5} />
              </IconButton>
            </div>
          </div>

          {groups.map(([optionKey, group]) => (
            <div key={optionKey} className="flex flex-wrap items-center gap-1.5">
              <span className="w-20 shrink-0 text-[11px] font-medium text-text-2">{group.label}:</span>
              {[...group.values.entries()].map(([slug, value]) => {
                const state = coverage(value.keys)
                return (
                  <Chip key={slug} state={state} onClick={() => toggleKeys(value.keys)} title={`${value.keys.length} wariantów`}>
                    {value.label}
                  </Chip>
                )
              })}
            </div>
          ))}

          <div className="flex flex-wrap gap-1.5 border-t border-primary/15 pt-2.5">
            <span className="w-full text-[11px] font-medium text-text-2">Pojedyncze warianty:</span>
            {variants.map((variant) => (
              <Chip key={variant.key} state={coverage([variant.key])} onClick={() => toggleKeys([variant.key])} title={variant.sku ?? undefined}>
                {variant.label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {variants.length > 0 && anyAssigned && (
        <details className="text-[11px] text-text-2">
          <summary className="cursor-pointer">Podgląd: ile własnych zdjęć ma każdy wariant</summary>
          <ul className="mt-1.5 grid gap-0.5 pl-4">
            {variants.map((variant) => {
              const count = ownCount(variant.key)
              return (
                <li key={variant.key} className={cn(!count && 'text-danger')}>
                  {variant.label}: {count ? `${count} własne + wspólne` : 'brak własnych — pokaże tylko wspólne'}
                </li>
              )
            })}
          </ul>
        </details>
      )}

      <span className="text-[11px] leading-[1.5] text-text-2">
        Pierwsze zdjęcie jest miniaturą w sklepie. Maks. 10 MB (większe zmniejszymy przed wysłaniem).
        {variants.length > 0 &&
          ' Pliki nazwane „slug-wartość.jpg” (np. „' +
            `${product.slug || 'produkt'}-${variants[0]?.options[0]?.slug ?? 'mint'}-2.jpg` +
            '”) przypiszą się same.'}
      </span>
    </div>
  )
}

function Chip({
  state,
  onClick,
  title,
  children,
}: {
  state: 'all' | 'some' | 'none'
  onClick: () => void
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={state === 'all'}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
        state === 'all' && 'border-primary bg-primary text-white',
        state === 'some' && 'border-primary/60 bg-primary/15 text-text',
        state === 'none' && 'border-border bg-surface text-text-2 hover:text-text',
      )}
    >
      {state === 'all' && <Check size={11} strokeWidth={2.5} />}
      {children}
    </button>
  )
}
