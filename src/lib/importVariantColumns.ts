import { normalizeToken } from './variantImages'

/*
 * Kolumny `stany_wariantow` i `ceny_wariantow` w CSV produktów — format
 * eksportu (lib/admin/productExport.ts), więc eksport → poprawki w Excelu →
 * import przenosi stany i ceny KAŻDEGO wariantu:
 *
 *   Rozmiar psa: Mały=5 | Rozmiar psa: Duży=2
 *   size: S · color: Czarny=84.99 | size: M · color: Biały=89.99
 *   PUM-001-MINT-01=3            ← zamiast opisu można podać SKU wariantu
 *   Rozmiar psa: Mały=—          ← „—” (albo puste) = stan nieprowadzony / brak własnej ceny
 *
 * Opis wariantu to pary „opcja: wartość” rozdzielone „·”. Opcję porównujemy
 * z kluczem albo nazwą filtra (`size` = „Rozmiar psa”), wartość z nazwą albo
 * slugiem wartości — bez wielkości liter i polskich znaków.
 *
 * Moduł czysty (bez importów serwerowych) — testowalny i wspólny dla importu
 * oraz podglądu zmian.
 */

export type VariantColumnEntry = {
  /** Tekst wpisu, do komunikatów. */
  raw: string
  /** Pary opcja → wartość; `null`, gdy wpis wskazuje wariant po SKU. */
  pairs: Array<{ name: string; value: string }> | null
  sku: string | null
  /** Liczba albo `null` (= „—”/puste: bez wartości). */
  value: number | null
}

export type VariantColumnParse = { entries: VariantColumnEntry[]; invalid: string[] }

/** Kandydaci do dopasowania: wariant opisany parami (nazwy opcji, wartości) i SKU. */
export type MatchableVariant = {
  sku?: string | null
  pairs: Array<{ names: string[]; values: string[] }>
}

const EMPTY_VALUES = new Set(['', '—', '-', '–', 'brak'])

function parseNumber(text: string): number | null | undefined {
  const clean = text.replace(/\s| |zł|pln|szt\.?/gi, '').trim()
  if (EMPTY_VALUES.has(clean.toLowerCase())) return null
  const normalized = clean.includes(',') && clean.includes('.')
    ? (clean.lastIndexOf(',') > clean.lastIndexOf('.') ? clean.replace(/\./g, '').replace(',', '.') : clean.replace(/,/g, ''))
    : clean.replace(',', '.')
  const number = Number(normalized)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

export function parseVariantColumn(cell: string | null | undefined): VariantColumnParse {
  const entries: VariantColumnEntry[] = []
  const invalid: string[] = []
  for (const part of String(cell ?? '').split('|')) {
    const raw = part.trim()
    if (!raw) continue
    const at = raw.lastIndexOf('=')
    if (at <= 0) {
      invalid.push(raw)
      continue
    }
    const left = raw.slice(0, at).trim()
    const value = parseNumber(raw.slice(at + 1))
    if (value === undefined) {
      invalid.push(raw)
      continue
    }
    if (left.includes(':')) {
      const pairs = left
        .split('·')
        .map((chunk) => {
          const colon = chunk.indexOf(':')
          return colon > 0 ? { name: chunk.slice(0, colon).trim(), value: chunk.slice(colon + 1).trim() } : null
        })
        .filter((pair): pair is { name: string; value: string } => Boolean(pair && pair.name && pair.value))
      if (!pairs.length) {
        invalid.push(raw)
        continue
      }
      entries.push({ raw, pairs, sku: null, value })
    } else {
      entries.push({ raw, pairs: null, sku: left, value })
    }
  }
  return { entries, invalid }
}

/** Opis wariantu z etykiety zapisanej w Sanity („Rozmiar psa: Mały · Kolor: mięta”). */
export function pairsFromLabel(label: string | null | undefined): MatchableVariant['pairs'] {
  return String(label ?? '')
    .split('·')
    .map((chunk) => {
      const colon = chunk.indexOf(':')
      if (colon <= 0) return null
      return { names: [chunk.slice(0, colon).trim()], values: [chunk.slice(colon + 1).trim()] }
    })
    .filter((pair): pair is { names: string[]; values: string[] } => Boolean(pair && pair.names[0] && pair.values[0]))
}

export function entryMatches(entry: VariantColumnEntry, variant: MatchableVariant): boolean {
  if (entry.sku) return Boolean(variant.sku) && normalizeToken(entry.sku) === normalizeToken(variant.sku!)
  const pairs = entry.pairs ?? []
  if (pairs.length !== variant.pairs.length) return false
  const used = new Set<number>()
  return pairs.every((pair) => {
    const name = normalizeToken(pair.name)
    const value = normalizeToken(pair.value)
    const index = variant.pairs.findIndex(
      (candidate, i) =>
        !used.has(i) &&
        candidate.names.some((n) => normalizeToken(n) === name) &&
        candidate.values.some((v) => normalizeToken(v) === value),
    )
    if (index < 0) return false
    used.add(index)
    return true
  })
}

/**
 * Wartość z kolumny dla każdego wariantu (w kolejności `variants`):
 * liczba, `null` (wpis z „—”) albo `undefined` (wariantu nie ma w kolumnie).
 * `unmatched` — wpisy, które nie pasują do żadnego wariantu (np. stary
 * rozmiar „S” po zmianie rozmiarów), `duplicated` — wariant wymieniony
 * dwa razy (wygrywa pierwszy wpis).
 */
export function assignVariantColumn(
  parse: VariantColumnParse,
  variants: MatchableVariant[],
): { values: Array<number | null | undefined>; unmatched: string[]; duplicated: string[] } {
  const values: Array<number | null | undefined> = variants.map(() => undefined)
  const unmatched: string[] = []
  const duplicated: string[] = []
  for (const entry of parse.entries) {
    const index = variants.findIndex((variant) => entryMatches(entry, variant))
    if (index < 0) unmatched.push(entry.raw)
    else if (values[index] !== undefined) duplicated.push(entry.raw)
    else values[index] = entry.value
  }
  return { values, unmatched, duplicated }
}
