'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Papa from 'papaparse'
import JSZip from 'jszip'
import {
  CheckCircle2, Download, FileArchive, FileSpreadsheet, ListChecks, Upload, X,
} from 'lucide-react'
import { adminValidateProductsCsv } from '@/actions/adminImport'
import { generateVariants, mapCsvRowToProductPartial, parseCollectionNames } from '@/sanity/helpers/productImportHelpers'
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
}

const SAMPLE_CSV = `title,subtitle,intro,sku,slug,shortDescription,description,price,currency,stock,category_slug,type,brand,vendor,tags,images,option_Size,option_Color,option_Extras,properties_width_cm,properties_height_cm,properties_length_cm,unit,weight_g,shipping_weight_g,material,care,isMachineWashable,isWaterproof,isFeatured,isBestseller,chew_strength,collections
"Pumpkin Plush Toy","Soft Corduroy Pumpkin","Idealna miękka zabawka dla psów","PUM-001","pumpkin-plush","Pluszowa dynia — 3 rozmiary","Miękka dynia z materiału corduroy, idealna dla psów małych i średnich.",29.99,PLN,50,toys,plush,PetCo,PetCo,"dynia;halloween","","S,M,L","orange,beige","rope",12,13,12,cm,140,180,corduroy,"Prać ręcznie",false,false,true,false,medium,"Halloween 2026;Zabawki pluszowe"`

const STEPS = ['Pliki', 'Sucha próba', 'Import'] as const

/**
 * Kreator importu produktów (format subcat1.csv):
 * 1) pliki (CSV + opcjonalny ZIP) i podgląd → 2) sucha próba (walidacja,
 * nic nie zapisuje) → 3) właściwy import przez /api/sanity/import-csv.
 */
export function ImportWizard() {
  const router = useRouter()
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvText, setCsvText] = useState('')
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [zipCount, setZipCount] = useState(0)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [dry, setDry] = useState<DryResult | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState('')
  const [validating, startValidation] = useTransition()
  const [importing, setImporting] = useState(false)
  const csvInput = useRef<HTMLInputElement>(null)
  const zipInput = useRef<HTMLInputElement>(null)

  const problems = dry ? dry.errors.length + dry.dupes.length : 0
  const step = logs.length ? 2 : dry ? 1 : 0
  const summary = useMemo(() => {
    const created = logs.filter((line) => line.startsWith('Created')).length
    const updated = logs.filter((line) => line.startsWith('Updated')).length
    const failed = logs.filter((line) => line.startsWith('Failed')).length
    const warnings = logs.filter((line) => line.includes('NOT FOUND')).length
    return { created, updated, failed, warnings }
  }, [logs])

  const reset = () => {
    setCsvFile(null)
    setCsvText('')
    setZipFile(null)
    setZipCount(0)
    setPreview([])
    setRowCount(0)
    setDry(null)
    setLogs([])
    setError('')
    if (csvInput.current) csvInput.current.value = ''
    if (zipInput.current) zipInput.current.value = ''
  }

  const pickCsv = (file: File | undefined) => {
    if (!file) return
    setCsvFile(file)
    setDry(null)
    setLogs([])
    setError('')
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = String(event.target?.result || '')
      setCsvText(text)
      const parsed = Papa.parse<Record<string, string | undefined>>(text, { header: true, skipEmptyLines: true })
      const rows = (parsed.data ?? []).filter(Boolean)
      setRowCount(rows.length)
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
          }
        })
      )
      if (parsed.errors?.length) setError(`CSV ma błędy składni (${parsed.errors.length}), np. wiersz ${parsed.errors[0].row}: ${parsed.errors[0].message}`)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const pickZip = async (file: File | undefined) => {
    setZipFile(null)
    setZipCount(0)
    if (!file) return
    try {
      const zip = await JSZip.loadAsync(await file.arrayBuffer())
      let count = 0
      zip.forEach((_, entry) => {
        if (!entry.dir) count += 1
      })
      if (!count) {
        setError('ZIP nie zawiera żadnych plików.')
        return
      }
      setZipFile(file)
      setZipCount(count)
    } catch {
      setError('Nie udało się odczytać ZIP-a — plik jest uszkodzony albo to nie ZIP.')
    }
  }

  const runDry = () =>
    startValidation(async () => {
      setError('')
      try {
        const res = await adminValidateProductsCsv(csvText)
        const errors = (res.errors ?? []).map((entry) =>
          typeof entry === 'string' ? { row: 0, field: 'csv', message: entry } : entry
        )
        const result: DryResult = { total: res.total, errors, dupes: res.dupes ?? [], perRow: res.perRow ?? [] }
        setDry(result)
        const failed = result.errors.length + result.dupes.length
        if (failed) toast.error(`${result.total} wierszy, ${failed} problemów — patrz raport`)
        else toast.success(`${result.total} wierszy wygląda dobrze`)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Walidacja nie powiodła się.')
      }
    })

  const runImport = async () => {
    if (!csvFile) return
    if (problems && !window.confirm(`Raport pokazuje ${problems} problemów. Importować mimo to? Wiersze z błędami mogą się nie zapisać.`)) return
    if (!zipFile && !window.confirm('Nie wybrano ZIP-a ze zdjęciami. Importować same dane?')) return
    setImporting(true)
    setError('')
    const form = new FormData()
    form.append('csvText', csvText)
    form.append('csvName', csvFile.name)
    if (zipFile) form.append('zip', zipFile)
    try {
      const res = await fetch('/api/sanity/import-csv', { method: 'POST', body: form })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error ?? `Błąd importu (HTTP ${res.status})`)
      setLogs(Array.isArray(json?.logs) && json.logs.length ? json.logs : ['Import zakończony bez komunikatów.'])
      toast.success('Import zakończony — sprawdź raport')
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Błąd podczas importu.')
    } finally {
      setImporting(false)
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

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={Upload}
        title="Import produktów"
        subtitle="Nowe SKU tworzą produkty, istniejące są aktualizowane. Zdjęcia z ZIP-a dopasowujemy po slugu (slug.jpg, slug-2.jpg…)."
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={downloadSample}>
              <Download size={14} strokeWidth={1.5} />
              Wzór CSV
            </Button>
            {(csvFile || logs.length > 0) && (
              <Button size="sm" variant="secondary" onClick={reset} disabled={importing}>
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
            title="Plik CSV z produktami"
            required
            name={csvFile ? `${csvFile.name} · ${rowCount} wierszy` : null}
            accept=".csv,text/csv"
            inputRef={csvInput}
            onPick={(file) => pickCsv(file)}
          />
          <FilePick
            icon={FileArchive}
            title="ZIP ze zdjęciami"
            name={zipFile ? `${zipFile.name} · ${zipCount} plików` : null}
            accept=".zip,application/zip"
            inputRef={zipInput}
            onPick={(file) => void pickZip(file)}
          />
        </div>

        {error && <ErrorBox>{error}</ErrorBox>}

        {preview.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-text-2">
              Podgląd {preview.length < rowCount ? `pierwszych ${preview.length} z ${rowCount}` : `${rowCount}`} wierszy
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
              Wierszy: {dry.total} · problemów: {problems}
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
            {!problems && <p className="mt-1 mb-0 text-success">Wszystko wygląda dobrze — możesz importować.</p>}
          </NoticeBox>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={runDry} disabled={!csvText || validating || importing}>
            <ListChecks size={15} strokeWidth={1.5} />
            {validating ? 'Sprawdzam…' : '1. Sucha próba'}
          </Button>
          <Button onClick={() => void runImport()} disabled={!csvText || !dry || importing || validating}>
            <Upload size={15} strokeWidth={1.5} />
            {importing ? 'Importuję… (to może potrwać)' : '2. Importuj do Sanity'}
          </Button>
        </div>
        {!dry && csvText && <p className="m-0 text-[11px] text-text-2">Import odblokuje się po suchej próbie.</p>}

        {logs.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="success">{`${summary.created} utworzonych`}</Badge>
              <Badge tone="info">{`${summary.updated} zaktualizowanych`}</Badge>
              {summary.failed > 0 && <Badge tone="danger">{`${summary.failed} błędów`}</Badge>}
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
  required,
  inputRef,
  onPick,
}: {
  icon: typeof Upload
  title: string
  name: string | null
  accept: string
  required?: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  onPick: (file: File | undefined) => void
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-xs border border-dashed px-3 py-3 transition-colors',
        name ? 'border-success/40 bg-success/5' : 'border-border-strong bg-bg hover:border-text-2'
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xs border border-border bg-surface text-text-2">
        <Icon size={16} strokeWidth={1.5} />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-xs font-semibold text-text">
          {title} {required ? <span className="text-danger">*</span> : <span className="font-normal text-text-2">(opcjonalnie)</span>}
        </strong>
        <span className="block truncate text-[11px] text-text-2">{name ?? 'Kliknij, aby wybrać plik'}</span>
      </span>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(event) => onPick(event.target.files?.[0])} />
    </label>
  )
}
