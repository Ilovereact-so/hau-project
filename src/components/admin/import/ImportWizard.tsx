'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Papa from 'papaparse'
import JSZip from 'jszip'
import {
  CheckCircle2, Download, FileArchive, FileSpreadsheet, Images, ListChecks, Upload, X,
} from 'lucide-react'
import { adminImageMatchCatalog, adminValidateProductsCsv } from '@/actions/adminImport'
import { adminUploadProductImage } from '@/actions/adminProducts'
import {
  generateVariants, mapCsvRowToProductPartial, parseCollectionNames, slugifyTitle, splitList,
} from '@/sanity/helpers/productImportHelpers'
import { normalizeToken, type VariantLike } from '@/lib/variantImages'
import {
  isImageFile, parseImagesColumn, planZipImages, sortPlans,
  type CatalogProduct, type ExplicitImage, type FilePlan,
} from '@/lib/zipImageMatching'
import { prepareImageForUpload } from '@/lib/imageUpload'
import { Badge } from '../kit/Badge'
import { Button } from '../kit/Button'
import { Card, CardHeader } from '../kit/Card'
import { DataTable, Td, Th, Tr } from '../kit/DataTable'
import { ErrorBox, NoticeBox } from '../kit/EmptyState'
import { formatCurrencyPrecise } from '../kit/format'
import { cn } from '../kit/utils'

type DryResult = {
  total: number
  errors: Array<{ row: number; field: string; message: string }>
  dupes: Array<{ a: number; b: number; type: string; value: string }>
  perRow: Array<{ row: number; ok: boolean; messages: string[] }>
}

type PreviewRow = {
  row: number
  title: string
  sku: string
  price: number | null
  stock: number | null
  category: string
  subcategory: string
  collections: string
  variants: number
  images: number
}

type ImportResult = { row: number; ok: boolean; id?: string; sku?: string; slug?: string; action?: 'create' | 'update' }
type Progress = { label: string; done: number; total: number }

/* Wzór zgodny z importerem: opcje wariantów w `productOptions`, ich wartości
   w kolumnach `filter_<opcja>`, zdjęcia w ZIP-ie nazwane po slugu. */
const SAMPLE_CSV = `title,subtitle,intro,sku,slug,shortDescription,description,price,currency,stock,category_slug,type,brand,vendor,tags,productOptions,filter_color,filter_size,images,properties_width_cm,properties_height_cm,properties_depth_cm,properties_units,weight_g,material,care,isMachineWashable,isWaterproof,isFeatured,isBestseller,chew_strength,collections
"Pluszowa dynia","Miękka dynia z corduroy","Idealna miękka zabawka dla psów","PUM-001","pluszowa-dynia","Pluszowa dynia — 3 rozmiary","Miękka dynia z materiału corduroy, idealna dla psów małych i średnich.",29.99,PLN,50,toys,plush,PetCo,PetCo,"dynia;halloween","color;size","orange;beige","S;M;L","",12,13,12,cm,140,corduroy,"Prać ręcznie",false,false,true,false,medium,"Halloween 2026;Zabawki pluszowe"`

const STEPS = ['Pliki', 'Sprawdzenie', 'Import', 'Gotowe'] as const
const ROWS_PER_BATCH = 10
const UPLOAD_CONCURRENCY = 3

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', tif: 'image/tiff', tiff: 'image/tiff',
}

async function sha1(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', await blob.arrayBuffer())
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Produkty z CSV w kształcie katalogu — do podglądu dopasowań PRZED importem (klucze wariantów umowne). */
type CsvProduct = CatalogProduct & { explicitSlug: boolean }

function csvCatalog(rows: Array<Record<string, string | undefined>>): CsvProduct[] {
  return rows
    .filter((row) => row.sku?.trim())
    .map((row) => {
      const options = splitList(row.productOptions ?? '').map(normalizeToken)
      const lists = Object.keys(row)
        .filter((column) => column.toLowerCase().startsWith('filter_') && options.includes(normalizeToken(column.slice(7))))
        .map((column) => splitList(row[column]).map((value) => ({ key: normalizeToken(column.slice(7)), slug: normalizeToken(value) })))
        .filter((list) => list.length)
      const combos = lists.length ? lists.reduce<Array<Array<{ key: string; slug: string }>>>((acc, list) => acc.flatMap((c) => list.map((v) => [...c, v])), [[]]) : []
      const variants: VariantLike[] = combos.map((combo, index) => ({
        _key: `csv-${index}`,
        optionValues: combo.map((option) => ({ name: { key: option.key }, value: { slug: { current: option.slug } } })),
      }))
      return {
        id: `csv:${row.sku!.trim()}`,
        sku: row.sku!.trim(),
        // Pusta kolumna slug: nowy produkt dostanie slug z tytułu, istniejący
        // zachowa swój (mergeCatalog) — tak samo jak na serwerze.
        slug: row.slug?.trim() || slugifyTitle(row.title),
        explicitSlug: Boolean(row.slug?.trim()),
        title: row.title ?? '',
        variants,
        imageHashes: [],
      }
    })
}

/** Katalog z Sanity + produkty z CSV (CSV nadpisuje po SKU — to on zaraz zostanie zapisany). */
function mergeCatalog(existing: CatalogProduct[], fromCsv: CsvProduct[]): CatalogProduct[] {
  const bySku = new Map(existing.map((product) => [normalizeToken(product.sku), product]))
  for (const product of fromCsv) {
    const current = bySku.get(normalizeToken(product.sku))
    bySku.set(normalizeToken(product.sku), current ? { ...current, slug: (product.explicitSlug && product.slug) || current.slug, title: product.title || current.title, variants: product.variants.length ? product.variants : current.variants } : product)
  }
  const withoutSku = existing.filter((product) => !product.sku)
  return [...bySku.values(), ...withoutSku]
}

/**
 * Kreator importu:
 * 1) pliki: CSV (dane) i/lub ZIP (zdjęcia) — sam ZIP dogrywa zdjęcia do istniejących produktów,
 * 2) sprawdzenie: walidacja CSV + podgląd, który plik trafi do którego produktu/wariantu,
 * 3) import: dane partiami, potem zdjęcia po jednym (z pominięciem już wgranych).
 */
export function ImportWizard() {
  const router = useRouter()
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvText, setCsvText] = useState('')
  const [csvRows, setCsvRows] = useState<Array<Record<string, string | undefined>>>([])
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [zipNames, setZipNames] = useState<string[]>([])
  const zipRef = useRef<JSZip | null>(null)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [dry, setDry] = useState<DryResult | null>(null)
  const [plan, setPlan] = useState<FilePlan[] | null>(null)
  const [catalog, setCatalog] = useState<CatalogProduct[]>([])
  const [manual, setManual] = useState<Record<string, string>>({})
  const [logs, setLogs] = useState<string[]>([])
  const [imageStats, setImageStats] = useState<{ uploaded: number; skipped: number; failed: number } | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [checking, startChecking] = useTransition()
  const [running, setRunning] = useState(false)
  const csvInput = useRef<HTMLInputElement>(null)
  const zipInput = useRef<HTMLInputElement>(null)

  const hasInput = Boolean(csvText || zipNames.length)
  const checked = Boolean(dry || plan)
  const problems = dry ? dry.errors.length + dry.dupes.length : 0
  const step = done ? 3 : running ? 2 : checked ? 1 : 0
  const summary = useMemo(() => {
    const created = logs.filter((line) => line.startsWith('Created')).length
    const updated = logs.filter((line) => line.startsWith('Updated')).length
    const failed = logs.filter((line) => line.startsWith('Failed')).length
    const warnings = logs.filter((line) => line.includes('NOT FOUND')).length
    const values = logs.filter((line) => line.startsWith('Utworzono wartość filtra')).length
    return { created, updated, failed, warnings, values }
  }, [logs])

  const explicitImages = useMemo(() => {
    const map = new Map<string, ExplicitImage>()
    for (const row of csvRows) if (row.sku?.trim() && row.images) parseImagesColumn(row.images, row.sku.trim(), map)
    return map
  }, [csvRows])

  const planStats = useMemo(() => {
    if (!plan) return null
    const resolved = plan.map((entry) => ({ ...entry, productId: manual[entry.file] ?? entry.productId }))
    const matched = resolved.filter((entry) => entry.productId)
    return {
      matched: matched.length,
      unmatched: resolved.length - matched.length,
      products: new Set(matched.map((entry) => entry.productId)).size,
      variant: matched.filter((entry) => entry.variantKeys.length).length,
    }
  }, [plan, manual])

  const reset = () => {
    setCsvFile(null)
    setCsvText('')
    setCsvRows([])
    setZipFile(null)
    setZipNames([])
    zipRef.current = null
    setPreview([])
    setDry(null)
    setPlan(null)
    setCatalog([])
    setManual({})
    setLogs([])
    setImageStats(null)
    setProgress(null)
    setDone(false)
    setError('')
    if (csvInput.current) csvInput.current.value = ''
    if (zipInput.current) zipInput.current.value = ''
  }

  const invalidateCheck = () => {
    setDry(null)
    setPlan(null)
    setManual({})
    setLogs([])
    setImageStats(null)
    setDone(false)
    setError('')
  }

  const pickCsv = (file: File | undefined) => {
    if (!file) return
    invalidateCheck()
    setCsvFile(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = String(event.target?.result || '').replace(/^﻿/, '')
      setCsvText(text)
      const parsed = Papa.parse<Record<string, string | undefined>>(text, { header: true, skipEmptyLines: true })
      const rows = (parsed.data ?? []).filter(Boolean)
      setCsvRows(rows)
      setPreview(
        rows.slice(0, 25).map((row, index) => {
          const partial = mapCsvRowToProductPartial(row) as Record<string, unknown> & { options?: unknown[] }
          let variants = 0
          try {
            variants = partial.options?.length ? generateVariants(partial.options as Parameters<typeof generateVariants>[0]).length : 0
          } catch {
            variants = 0
          }
          const price = Number(row.price)
          const stock = Number(row.stock)
          return {
            row: index + 2,
            title: row.title ?? '',
            sku: row.sku ?? '',
            price: Number.isFinite(price) && row.price ? price : null,
            stock: Number.isFinite(stock) && row.stock ? stock : null,
            category: row.category_slug ?? '',
            subcategory: row.type ?? '',
            collections: parseCollectionNames(row).join(', '),
            variants,
            images: parseImagesColumn(row.images, row.sku ?? '').size,
          }
        })
      )
      if (parsed.errors?.length) setError(`CSV ma błędy składni (${parsed.errors.length}), np. wiersz ${parsed.errors[0].row}: ${parsed.errors[0].message}`)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const pickZip = async (file: File | undefined) => {
    invalidateCheck()
    setZipFile(null)
    setZipNames([])
    zipRef.current = null
    if (!file) return
    try {
      const zip = await JSZip.loadAsync(await file.arrayBuffer())
      const names: string[] = []
      zip.forEach((path, entry) => {
        if (!entry.dir && isImageFile(path)) names.push(path)
      })
      if (!names.length) {
        setError('ZIP nie zawiera zdjęć (JPG, PNG, WebP…).')
        return
      }
      zipRef.current = zip
      setZipFile(file)
      setZipNames(names)
    } catch {
      setError('Nie udało się odczytać ZIP-a — plik jest uszkodzony albo to nie ZIP.')
    }
  }

  // ─── krok 2: sprawdzenie ────────────────────────────────────────────────────
  const runCheck = () =>
    startChecking(async () => {
      setError('')
      try {
        if (csvText) {
          const res = await adminValidateProductsCsv(csvText)
          const errors = (res.errors ?? []).map((entry) =>
            typeof entry === 'string' ? { row: 0, field: 'csv', message: entry } : entry
          )
          setDry({ total: res.total, errors, dupes: res.dupes ?? [], perRow: res.perRow ?? [] })
        }
        if (zipNames.length) {
          const existing = await adminImageMatchCatalog()
          const merged = mergeCatalog(existing, csvCatalog(csvRows))
          setCatalog(merged)
          setPlan(planZipImages(zipNames, merged, explicitImages))
        }
        toast.success('Sprawdzone — zobacz podsumowanie')
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Sprawdzenie nie powiodło się.')
      }
    })

  // ─── krok 3: import ─────────────────────────────────────────────────────────
  const importRows = async (): Promise<ImportResult[]> => {
    const header = Papa.parse<string[]>(csvText, { preview: 1 }).data[0] ?? []
    const results: ImportResult[] = []
    let jobId = ''
    const total = csvRows.length
    for (let start = 0; start < total; start += ROWS_PER_BATCH) {
      const batch = csvRows.slice(start, start + ROWS_PER_BATCH)
      setProgress({ label: 'Zapisuję produkty', done: start, total })
      const form = new FormData()
      form.append('csvText', Papa.unparse({ fields: header, data: batch.map((row) => header.map((column) => row[column] ?? '')) }))
      form.append('csvName', csvFile?.name ?? 'produkty.csv')
      form.append('firstRow', String(start + 2))
      form.append('totalRows', String(total))
      form.append('last', start + ROWS_PER_BATCH >= total ? '1' : '0')
      if (jobId) form.append('jobId', jobId)
      const res = await fetch('/api/sanity/import-csv', { method: 'POST', body: form })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error ?? `Błąd importu (HTTP ${res.status}) — wiersze od ${start + 2}`)
      jobId = json.jobId ?? jobId
      results.push(...(json.results ?? []))
      setLogs((current) => [...current, ...(json.logs ?? [])])
    }
    setProgress({ label: 'Zapisuję produkty', done: total, total })
    return results
  }

  const uploadImages = async (imported: ImportResult[]) => {
    const zip = zipRef.current
    if (!zip || !plan) return
    // Świeży katalog: prawdziwe klucze wariantów nowych produktów.
    setProgress({ label: 'Przygotowuję zdjęcia', done: 0, total: plan.length })
    const fresh = await adminImageMatchCatalog()
    const idBySku = new Map(fresh.map((product) => [normalizeToken(product.sku), product.id]))
    for (const result of imported) if (result.id && result.sku) idBySku.set(normalizeToken(result.sku), result.id)
    const resolveId = (id: string | null) => (id?.startsWith('csv:') ? idBySku.get(normalizeToken(id.slice(4))) ?? null : id)

    const finalPlan = sortPlans(
      planZipImages(zipNames, fresh, explicitImages).map((entry) => {
        const chosen = resolveId(manual[entry.file] ?? null)
        return chosen && chosen !== entry.productId ? { ...entry, productId: chosen, variantKeys: [], source: 'manual' as const } : entry
      })
    ).filter((entry) => entry.productId)

    const byProduct = new Map<string, FilePlan[]>()
    for (const entry of finalPlan) byProduct.set(entry.productId!, [...(byProduct.get(entry.productId!) ?? []), entry])
    const products = new Map(fresh.map((product) => [product.id, product]))
    const stats = { uploaded: 0, skipped: 0, failed: 0 }
    let processed = 0
    const total = finalPlan.length
    setProgress({ label: 'Wysyłam zdjęcia', done: 0, total })

    const queue = [...byProduct.entries()]
    const worker = async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        const [productId, entries] = item
        const product = products.get(productId)
        const hashes = new Set(product?.imageHashes ?? [])
        // Zdjęcia jednego produktu po kolei — zachowują kolejność z nazw plików.
        for (const entry of entries) {
          try {
            const blob = await zip.file(entry.file)!.async('blob')
            const ext = (entry.file.split('.').pop() ?? '').toLowerCase()
            const original = new File([blob], entry.file.split('/').pop() ?? 'zdjecie', { type: MIME[ext] ?? 'image/jpeg' })
            const hash = await sha1(original)
            if (hashes.has(hash)) {
              stats.skipped += 1
              continue
            }
            const file = await prepareImageForUpload(original)
            const form = new FormData()
            form.set('productId', productId)
            form.set('alt', product?.title ?? '')
            form.set('file', file)
            for (const key of entry.variantKeys) form.append('variantKeys', key)
            const result = await adminUploadProductImage(form)
            if (result.ok) {
              stats.uploaded += 1
              hashes.add(hash)
            } else {
              stats.failed += 1
              setLogs((current) => [...current, `Failed image ${entry.file}: ${result.error}`])
            }
          } catch (err) {
            stats.failed += 1
            setLogs((current) => [...current, `Failed image ${entry.file}: ${err instanceof Error ? err.message : 'błąd wysyłki'}`])
          } finally {
            processed += 1
            setProgress({ label: 'Wysyłam zdjęcia', done: processed, total })
          }
        }
      }
    }
    await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker))
    setImageStats(stats)
    setLogs((current) => [...current, `Zdjęcia: wysłano ${stats.uploaded}, pominięto już wgrane ${stats.skipped}, błędy ${stats.failed}`])
  }

  const runImport = async () => {
    if (!hasInput) return
    if (problems && !window.confirm(`Sprawdzenie pokazało ${problems} problemów w CSV. Importować mimo to? Wiersze z błędami mogą się nie zapisać.`)) return
    if (planStats?.unmatched && !window.confirm(`${planStats.unmatched} zdjęć nie ma przypisanego produktu — zostaną pominięte. Kontynuować?`)) return
    setRunning(true)
    setError('')
    setLogs([])
    setImageStats(null)
    try {
      const imported = csvText ? await importRows() : []
      if (zipNames.length) await uploadImages(imported)
      setDone(true)
      toast.success('Import zakończony — sprawdź raport')
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Błąd podczas importu.')
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  const downloadSample = () => {
    const blob = new Blob(['﻿', SAMPLE_CSV], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'wzor_produktow.csv'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const productLabel = (id: string | null) => {
    if (!id) return null
    const product = catalog.find((entry) => entry.id === id)
    return product ? `${product.title || product.sku}${id.startsWith('csv:') ? ' (z CSV)' : ''}` : id
  }
  const variantText = (entry: FilePlan) => (entry.values.length ? entry.values.join(' + ') : 'wspólne')

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={Upload}
        title="Import produktów i zdjęć"
        subtitle="CSV zakłada i aktualizuje produkty (po SKU). ZIP ze zdjęciami przypisuje je po nazwach plików: slug.jpg, slug-2.jpg (wspólne), slug-mint.jpg (wariant). Sam ZIP dogrywa zdjęcia do istniejących produktów."
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={downloadSample}>
              <Download size={14} strokeWidth={1.5} />
              Wzór CSV
            </Button>
            {(hasInput || logs.length > 0) && (
              <Button size="sm" variant="secondary" onClick={reset} disabled={running}>
                <X size={14} strokeWidth={1.5} />
                Zacznij od nowa
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-4 px-4 pt-3 pb-4">
        <ol className="m-0 flex list-none flex-wrap gap-2 p-0">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                index < step && 'border-success/30 bg-success/10 text-success',
                index === step && 'border-primary/30 bg-primary/10 text-primary',
                index > step && 'border-border bg-surface text-text-2'
              )}
            >
              {index < step ? <CheckCircle2 size={12} strokeWidth={2} /> : <span>{index + 1}.</span>}
              {label}
            </li>
          ))}
        </ol>

        <div className="grid gap-3 md:grid-cols-2">
          <FilePick
            icon={FileSpreadsheet}
            title="CSV z produktami"
            name={csvFile ? `${csvFile.name} · ${csvRows.length} wierszy` : null}
            accept=".csv,text/csv"
            inputRef={csvInput}
            disabled={running}
            onPick={(file) => pickCsv(file)}
          />
          <FilePick
            icon={FileArchive}
            title="ZIP ze zdjęciami"
            name={zipFile ? `${zipFile.name} · ${zipNames.length} zdjęć` : null}
            accept=".zip,application/zip"
            inputRef={zipInput}
            disabled={running}
            onPick={(file) => void pickZip(file)}
          />
        </div>

        <details className="rounded-xs border border-border bg-surface px-3 py-2 text-[11px] leading-[1.6] text-text-2">
          <summary className="cursor-pointer font-medium text-text">Jak przygotować pliki (najmniej pracy)</summary>
          <ul className="mt-1.5 mb-0 grid gap-1 pl-4">
            <li><strong>Warianty</strong>: w <code>productOptions</code> wpisz opcje (np. <code>color;size</code>), a wartości w kolumnach <code>filter_color</code> = <code>mint;beige</code>, <code>filter_size</code> = <code>S;M;L</code>. Powstanie 6 wariantów. Brakujące wartości (nowy kolor) utworzą się same.</li>
            <li><strong>Aktualizacja</strong> istniejącego SKU zachowuje warianty (klucze, SKU, własne ceny i stany), zdjęcia i adres strony. Pusta kolumna <code>stock</code> nie zmienia stanów.</li>
            <li><strong>Zdjęcia w ZIP-ie</strong> (także w podfolderach): <code>slug.jpg</code>, <code>slug-2.jpg</code> — wspólne (pierwsze = główne); <code>slug-mint.jpg</code>, <code>slug-mint-3.jpg</code> — wszystkie warianty w kolorze mint; <code>slug-mint-m.jpg</code> — tylko mint/M. Zamiast sluga można użyć SKU.</li>
            <li>Nazwy dowolne? Wypisz je w kolumnie <code>images</code>: <code>front.jpg; tyl.jpg; zielona.jpg=mint; zielona-m.jpg=mint+m</code>.</li>
            <li>Duże zdjęcia (ponad 10 MB) zmniejszymy w przeglądarce. Zdjęcia już wgrane do produktu są pomijane, więc ZIP można wysłać ponownie.</li>
          </ul>
        </details>

        {error && <ErrorBox>{error}</ErrorBox>}

        {preview.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-text-2">
              Podgląd {preview.length < csvRows.length ? `pierwszych ${preview.length} z ${csvRows.length}` : `${csvRows.length}`} wierszy
            </span>
            <DataTable>
              <thead>
                <tr>
                  <Th>Wiersz</Th>
                  <Th>Produkt</Th>
                  <Th>SKU</Th>
                  <Th className="text-right">Cena</Th>
                  <Th className="text-right">Stan</Th>
                  <Th>Kategoria / typ</Th>
                  <Th>Kolekcje</Th>
                  <Th className="text-right">Warianty</Th>
                  {dry && <Th>Walidacja</Th>}
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => {
                  const check = dry?.perRow.find((entry) => entry.row === row.row)
                  return (
                    <Tr key={row.row}>
                      <Td className="text-text-2">{row.row}</Td>
                      <Td className="max-w-[260px] truncate font-medium">{row.title || <span className="text-danger">brak nazwy</span>}</Td>
                      <Td>
                        <code className="font-mono text-[11px]">{row.sku || '—'}</code>
                      </Td>
                      <Td className="text-right whitespace-nowrap">{row.price !== null ? formatCurrencyPrecise(row.price) : '—'}</Td>
                      <Td className="text-right">{row.stock ?? '—'}</Td>
                      <Td className="text-text-2">{[row.category, row.subcategory].filter(Boolean).join(' / ') || '—'}</Td>
                      <Td className="max-w-[200px] truncate text-text-2" title={row.collections}>{row.collections || '—'}</Td>
                      <Td className="text-right">{row.variants || '—'}</Td>
                      {dry && (
                        <Td className="max-w-[280px]">
                          {check?.ok ? (
                            <Badge tone="success">OK</Badge>
                          ) : (
                            <span className="block truncate text-[11px] text-danger" title={check?.messages.join('; ')}>
                              {check?.messages.join('; ') || '—'}
                            </span>
                          )}
                        </Td>
                      )}
                    </Tr>
                  )
                })}
              </tbody>
            </DataTable>
          </div>
        )}

        {dry && (
          <NoticeBox className={problems ? 'border-danger/30 bg-danger/5' : 'border-success/30 bg-success/5'}>
            <strong className="text-text">
              CSV — wierszy: {dry.total} · problemów: {problems}
            </strong>
            {dry.dupes.length > 0 && (
              <p className="mt-1.5 mb-0 text-danger">
                Duplikaty: {dry.dupes.map((d) => `${d.type} „${d.value}” (wiersze ${d.a} i ${d.b})`).join('; ')}
              </p>
            )}
            {dry.errors.slice(0, 12).map((entry, index) => (
              <p key={index} className="mt-1 mb-0 text-danger">
                {entry.row ? `Wiersz ${entry.row}` : 'Plik'} · {entry.field}: {entry.message}
              </p>
            ))}
            {dry.errors.length > 12 && <p className="mt-1 mb-0">… i {dry.errors.length - 12} więcej</p>}
            {!problems && <p className="mt-1 mb-0 text-success">Dane wyglądają dobrze.</p>}
          </NoticeBox>
        )}

        {plan && planStats && (
          <div className="flex flex-col gap-2">
            <NoticeBox className={planStats.unmatched ? 'border-primary/30 bg-primary/5' : 'border-success/30 bg-success/5'}>
              <strong className="text-text">
                Zdjęcia — {plan.length} plików: {planStats.matched} do {planStats.products} produktów ({planStats.variant} przypisanych do wariantów)
                {planStats.unmatched ? `, ${planStats.unmatched} bez produktu` : ''}
              </strong>
              {planStats.unmatched > 0 && (
                <p className="mt-1 mb-0">Wybierz produkt dla niedopasowanych plików poniżej albo popraw nazwy w ZIP-ie. Nieprzypisane zostaną pominięte.</p>
              )}
            </NoticeBox>
            <details open={planStats.unmatched > 0} className="rounded-xs border border-border bg-surface px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-text">
                <Images size={13} strokeWidth={1.5} className="mr-1 inline" />
                Dopasowanie plików
              </summary>
              <div className="mt-2 max-h-[360px] overflow-auto">
                <DataTable>
                  <thead>
                    <tr>
                      <Th>Plik</Th>
                      <Th>Produkt</Th>
                      <Th>Warianty</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...plan]
                      .sort((a, b) => Number(Boolean(a.productId)) - Number(Boolean(b.productId)) || a.file.localeCompare(b.file, 'pl', { numeric: true }))
                      .map((entry) => (
                        <Tr key={entry.file}>
                          <Td className="max-w-[260px] truncate font-mono text-[11px]" title={entry.file}>{entry.file}</Td>
                          <Td className="max-w-[300px]">
                            {entry.productId && !manual[entry.file] ? (
                              <span className="truncate">
                                {productLabel(entry.productId)}
                                {entry.source === 'csv' && <Badge tone="info" className="ml-1.5">kolumna images</Badge>}
                              </span>
                            ) : (
                              <select
                                value={manual[entry.file] ?? ''}
                                onChange={(event) => setManual((current) => ({ ...current, [entry.file]: event.target.value }))}
                                className={cn('w-full rounded-xs border bg-surface px-2 py-1 text-xs', manual[entry.file] ? 'border-border' : 'border-danger/50')}
                              >
                                <option value="">— pomiń —</option>
                                {catalog.map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.title || product.sku} {product.sku ? `(${product.sku})` : ''}
                                  </option>
                                ))}
                              </select>
                            )}
                          </Td>
                          <Td className="text-text-2">{entry.productId && !manual[entry.file] ? variantText(entry) : manual[entry.file] ? 'wspólne' : '—'}</Td>
                        </Tr>
                      ))}
                  </tbody>
                </DataTable>
              </div>
            </details>
          </div>
        )}

        {progress && (
          <div className="grid gap-1">
            <div className="flex justify-between text-[11px] text-text-2">
              <span>{progress.label}…</span>
              <span>
                {progress.done}/{progress.total}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={runCheck} disabled={!hasInput || checking || running}>
            <ListChecks size={15} strokeWidth={1.5} />
            {checking ? 'Sprawdzam…' : '1. Sprawdź'}
          </Button>
          <Button onClick={() => void runImport()} disabled={!hasInput || !checked || running || checking}>
            <Upload size={15} strokeWidth={1.5} />
            {running ? 'Importuję… (nie zamykaj karty)' : csvText ? (zipNames.length ? '2. Importuj dane i zdjęcia' : '2. Importuj dane') : '2. Wyślij zdjęcia'}
          </Button>
        </div>
        {!checked && hasInput && <p className="m-0 text-[11px] text-text-2">Import odblokuje się po sprawdzeniu.</p>}

        {logs.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {csvText && <Badge tone="success">{`${summary.created} utworzonych`}</Badge>}
              {csvText && <Badge tone="info">{`${summary.updated} zaktualizowanych`}</Badge>}
              {summary.values > 0 && <Badge tone="purple">{`${summary.values} nowych wartości filtrów`}</Badge>}
              {imageStats && <Badge tone="success">{`${imageStats.uploaded} zdjęć wysłanych`}</Badge>}
              {imageStats?.skipped ? <Badge tone="neutral">{`${imageStats.skipped} już było`}</Badge> : null}
              {summary.failed + (imageStats?.failed ?? 0) > 0 && <Badge tone="danger">{`${summary.failed + (imageStats?.failed ?? 0)} błędów`}</Badge>}
              {summary.warnings > 0 && <Badge tone="primary">{`${summary.warnings} ostrzeżeń (brakujące filtry/kategorie)`}</Badge>}
            </div>
            <details className="rounded-xs border border-border bg-surface px-3 py-2 text-[11px] text-text-2">
              <summary className="cursor-pointer font-medium text-text">Pełny raport ({logs.length} linii)</summary>
              <pre className="mt-2 max-h-[320px] overflow-auto font-mono whitespace-pre-wrap">
                {logs.map((line, index) => `${index + 1}: ${line}`).join('\n')}
              </pre>
            </details>
          </div>
        )}
      </div>
    </Card>
  )
}

function FilePick({
  icon: Icon,
  title,
  name,
  accept,
  inputRef,
  disabled,
  onPick,
}: {
  icon: typeof Upload
  title: string
  name: string | null
  accept: string
  inputRef: React.RefObject<HTMLInputElement | null>
  disabled?: boolean
  onPick: (file: File | undefined) => void
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-xs border border-dashed px-3 py-3 transition-colors',
        name ? 'border-success/40 bg-success/5' : 'border-border-strong bg-bg hover:border-text-2',
        disabled && 'pointer-events-none opacity-60'
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xs border border-border bg-surface text-text-2">
        <Icon size={16} strokeWidth={1.5} />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-xs font-semibold text-text">
          {title} <span className="font-normal text-text-2">(opcjonalnie)</span>
        </strong>
        <span className="block truncate text-[11px] text-text-2">{name ?? 'Kliknij, aby wybrać plik'}</span>
      </span>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(event) => onPick(event.target.files?.[0])} />
    </label>
  )
}
