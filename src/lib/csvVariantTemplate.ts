import Papa from 'papaparse'
import { assignVariantColumn, parseVariantColumn, type MatchableVariant } from './importVariantColumns'
import { normalizeToken } from './variantImages'

/*
 * „Uzupełnij stany i ceny wariantów” w kreatorze importu: dla każdego wiersza
 * z `productOptions` wypisuje w `stany_wariantow` i `ceny_wariantow` KAŻDĄ
 * kombinację wartości opcji (ten sam iloczyn, który zbuduje import), żeby
 * w Excelu zostało tylko wpisanie liczb:
 *
 *   productOptions = color;rozmiar, filter_color = Różowy;Niebieski, filter_rozmiar = S;M
 *   → stany_wariantow = color: Różowy · rozmiar: S=0 | color: Różowy · rozmiar: M=0 | …
 *   → ceny_wariantow  = color: Różowy · rozmiar: S=— | …   („—” = cena z `price`)
 *
 * Wartości już wpisane dla danej kombinacji ZOSTAJĄ. Wpisy, które nie pasują
 * do żadnej kombinacji (np. stary rozmiar), są usuwane i wymienione w raporcie.
 * Wiersze bez `productOptions` (produkty bez wariantów albo warianty ułożone
 * ręcznie) zostają bez zmian. Działa w przeglądarce — plik nie idzie na serwer.
 */

export const STOCK_COLUMN = 'stany_wariantow'
export const PRICE_COLUMN = 'ceny_wariantow'

/** Domyślny stan nowej kombinacji — do zmiany w Excelu. */
export const DEFAULT_VARIANT_STOCK = 0

const splitValues = (cell: string | null | undefined) =>
  String(cell ?? '')
    .split(/[;,]/)
    .map((value) => value.trim())
    .filter(Boolean)

const formatNumber = (value: number) => (Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100))

/** Klucz filtra (znormalizowany) → nazwa z Sanity, np. `color` → „Kolor” — żeby wpis „Kolor: Różowy=3” też pasował. */
export type FilterLabels = Record<string, string>

export type TemplateReport = {
  /** Wiersze, w których coś dopisano albo usunięto. */
  filled: Array<{ row: number; sku: string; variants: number; added: number }>
  removed: Array<{ row: number; sku: string; entries: string[] }>
  skipped: Array<{ row: number; sku: string; reason: string }>
}

/** Kombinacje opcji wiersza: [{ key, value }] w kolejności `productOptions`. */
export function variantCombos(row: Record<string, string | undefined>): { combos: Array<Array<{ key: string; value: string }>>; missing: string[] } {
  const keys = splitValues(row.productOptions)
  const columns = Object.keys(row).filter((column) => column.toLowerCase().startsWith('filter_'))
  const lists: Array<Array<{ key: string; value: string }>> = []
  const missing: string[] = []
  for (const key of keys) {
    const column = columns.find((c) => normalizeToken(c.slice('filter_'.length)) === normalizeToken(key))
    const values: string[] = []
    for (const value of column ? splitValues(row[column]) : []) {
      if (!values.some((v) => normalizeToken(v) === normalizeToken(value))) values.push(value)
    }
    if (!values.length) missing.push(key)
    else lists.push(values.map((value) => ({ key, value })))
  }
  if (missing.length || !lists.length) return { combos: [], missing }
  const combos = lists.reduce<Array<Array<{ key: string; value: string }>>>((acc, list) => acc.flatMap((combo) => list.map((item) => [...combo, item])), [[]])
  return { combos, missing }
}

/** Uzupełnia jeden wiersz (zwraca nowe wartości kolumn albo `null`, gdy wiersz pomijamy). */
export function completeVariantRow(row: Record<string, string | undefined>, labels: FilterLabels = {}): {
  stock: string
  price: string
  variants: number
  added: number
  removed: string[]
} | { skip: string } | null {
  if (!splitValues(row.productOptions).length) return null
  const { combos, missing } = variantCombos(row)
  if (missing.length) return { skip: `brak wartości w kolumnie filter_${missing.join(', filter_')}` }
  const label = (combo: Array<{ key: string; value: string }>) => combo.map(({ key, value }) => `${key}: ${value}`).join(' · ')
  const matchable: MatchableVariant[] = combos.map((combo) => ({
    pairs: combo.map(({ key, value }) => ({ names: [key, labels[normalizeToken(key)] ?? ''].filter(Boolean), values: [value] })),
  }))
  const stockParse = parseVariantColumn(row[STOCK_COLUMN])
  const priceParse = parseVariantColumn(row[PRICE_COLUMN])
  const stocks = assignVariantColumn(stockParse, matchable)
  const prices = assignVariantColumn(priceParse, matchable)
  const productPrice = Number(String(row.price ?? '').replace(/\s|zł/gi, '').replace(',', '.'))
  let added = 0
  const stockEntries = combos.map((combo, index) => {
    const value = stocks.values[index]
    if (value === undefined) added += 1
    return `${label(combo)}=${value === undefined ? DEFAULT_VARIANT_STOCK : value === null ? '—' : formatNumber(value)}`
  })
  // Cena: wpisana zostaje; brak = „—” (cena z kolumny `price`). NIE wpisujemy
  // ceny produktu jako liczby — po zmianie `price` wszystkie warianty zostałyby
  // ze starą ceną jako własną. Liczbę wpisuje się tylko wariantom droższym/tańszym.
  const priceEntries = combos.map((combo, index) => {
    const value = prices.values[index]
    const own = typeof value === 'number' && !(Number.isFinite(productPrice) && value === productPrice) ? value : null
    return `${label(combo)}=${own === null ? '—' : formatNumber(own)}`
  })
  return {
    stock: stockEntries.join(' | '),
    price: priceEntries.join(' | '),
    variants: combos.length,
    added,
    removed: [...new Set([...stocks.unmatched, ...prices.unmatched, ...stockParse.invalid, ...priceParse.invalid])],
  }
}

/**
 * Cały plik: ten sam separator co wejście, BOM (polski Excel otwiera UTF-8
 * poprawnie), kolumny `stany_wariantow`/`ceny_wariantow` dopisane na końcu,
 * jeśli ich nie było.
 */
export function completeVariantColumnsCsv(text: string, labels: FilterLabels = {}): { csv: string; report: TemplateReport } {
  const parsed = Papa.parse<Record<string, string | undefined>>(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: true })
  const fields = [...(parsed.meta.fields ?? [])]
  for (const column of [STOCK_COLUMN, PRICE_COLUMN]) if (!fields.includes(column)) fields.push(column)
  const report: TemplateReport = { filled: [], removed: [], skipped: [] }
  const data = parsed.data.filter(Boolean).map((row, index) => {
    const rowNumber = index + 2
    const sku = String(row.sku ?? '').trim()
    const result = completeVariantRow(row, labels)
    if (!result) return row
    if ('skip' in result) {
      report.skipped.push({ row: rowNumber, sku, reason: result.skip })
      return row
    }
    if (result.removed.length) report.removed.push({ row: rowNumber, sku, entries: result.removed })
    const changed = result.stock !== String(row[STOCK_COLUMN] ?? '').trim() || result.price !== String(row[PRICE_COLUMN] ?? '').trim()
    if (changed) report.filled.push({ row: rowNumber, sku, variants: result.variants, added: result.added })
    return { ...row, [STOCK_COLUMN]: result.stock, [PRICE_COLUMN]: result.price }
  })
  const csv = Papa.unparse({ fields, data: data.map((row) => fields.map((field) => row[field] ?? '')) }, { delimiter: parsed.meta.delimiter || ';', newline: '\r\n' })
  return { csv: `﻿${csv}`, report }
}
