/*
 * Automatyczne zdejmowanie stanu — czysta logika (bez bazy i Sanity), wspólna
 * dla serwera (lib/inventory.server.ts) i testów.
 *
 * Gdzie leży stan pozycji — ta sama reguła co `variantStock` w lib/stock.ts:
 *  1. wariant ma własną liczbę `variants[].stock` → zmieniamy ją,
 *  2. w przeciwnym razie produkt ma `stock` → zmieniamy stan produktu
 *     (wspólny dla wariantów bez własnego stanu),
 *  3. brak liczby w obu miejscach → stan nieprowadzony, nic nie zmieniamy.
 * Stan nigdy nie schodzi poniżej zera: gdy towaru zabrakło (np. dwie osoby
 * kupiły ostatnią sztukę w tej samej minucie), zdejmujemy tyle, ile było,
 * a brak trafia do notatki zamówienia w panelu.
 */

export type StockTarget = 'variant' | 'product' | 'untracked'
export type StockChangeKind = 'deduct' | 'restore'

export type StockDocFields = {
  stock?: number | null
  variants?: Array<{ _key?: string | null; stock?: number | null } | null> | null
}

export type StockPlan = {
  target: StockTarget
  /** Ścieżka pola w dokumencie Sanity (`null` = stan nieprowadzony). */
  path: string | null
  before: number | null
  after: number | null
  /** Ile sztuk faktycznie zdjęto / oddano. */
  applied: number
  /** Ile sztuk zabrakło przy zdejmowaniu (0 = wystarczyło). */
  shortage: number
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const normalize = (value: number) => Math.max(0, Math.floor(value))

/** Klucz `_key` wariantu wolno wstawić do ścieżki GROQ tylko w bezpiecznej postaci. */
export function safeVariantKey(key: string): string {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(key)) throw new Error(`Nieprawidłowy klucz wariantu: ${key}`)
  return key
}

/**
 * Wylicza zmianę stanu jednej pozycji i OD RAZU nanosi ją na `doc` (kopię
 * roboczą), żeby kolejna pozycja tego samego produktu — np. drugi wariant
 * korzystający ze wspólnego stanu produktu — liczyła się od nowej wartości.
 */
export function applyStockChange(
  doc: StockDocFields,
  variantKey: string | null,
  kind: StockChangeKind,
  qty: number,
): StockPlan {
  const amount = Math.max(0, Math.floor(qty))
  const variant = variantKey ? doc.variants?.find((v) => v?._key === variantKey) ?? null : null

  let target: StockTarget = 'untracked'
  let path: string | null = null
  let before: number | null = null
  if (variant && isCount(variant.stock)) {
    target = 'variant'
    path = `variants[_key=="${safeVariantKey(variantKey as string)}"].stock`
    before = normalize(variant.stock)
  } else if (isCount(doc.stock)) {
    target = 'product'
    path = 'stock'
    before = normalize(doc.stock)
  }

  if (before === null) {
    return { target, path: null, before: null, after: null, applied: 0, shortage: 0 }
  }

  const applied = kind === 'deduct' ? Math.min(amount, before) : amount
  const after = kind === 'deduct' ? before - applied : before + applied
  if (target === 'variant' && variant) variant.stock = after
  else doc.stock = after
  return { target, path, before, after, applied, shortage: kind === 'deduct' ? amount - applied : 0 }
}

/** Kopia pól stanu dokumentu (żeby wyliczenia nie zmieniały danych z zapytania). */
export function cloneStockFields(doc: StockDocFields): StockDocFields {
  return {
    stock: doc.stock ?? null,
    variants: (doc.variants ?? []).map((v) => (v ? { _key: v._key ?? null, stock: v.stock ?? null } : null)),
  }
}

export type OrderLineInput = { productId: string; variantId: string | null; qty: number }
export type StockLine = { productId: string; variantKey: string; qty: number }

/** Pozycje zamówienia zsumowane po produkcie i wariancie (ta sama pozycja dwa razy = jedna linia). */
export function groupOrderLines(items: OrderLineInput[]): StockLine[] {
  const lines = new Map<string, StockLine>()
  for (const item of items) {
    const qty = Math.max(0, Math.floor(item.qty))
    if (!item.productId || qty <= 0) continue
    const variantKey = item.variantId ?? ''
    const key = `${item.productId}::${variantKey}`
    const line = lines.get(key)
    if (line) line.qty += qty
    else lines.set(key, { productId: item.productId, variantKey, qty })
  }
  return [...lines.values()]
}
