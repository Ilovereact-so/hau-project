// Czysta logika koszyka/wishlisty współdzielona przez serwer (akcje, API) i
// klienta (store). Bez importów serwerowych — da się ją testować w izolacji.

export type CartLine = {
  productId: string
  variantId: string
  qty:       number
}

// Górne limity chronią Redis/MySQL przed złośliwym lub zepsutym payloadem —
// akcje serwerowe i trasy API są publicznymi endpointami.
export const MAX_CART_LINES    = 100
export const MAX_LINE_QTY      = 99
export const MAX_WISHLIST_SIZE = 200

// Identyfikatory dokumentów Sanity: litery, cyfry, '-', '_', '.'.
// Klucze wariantów (_key) mają ten sam alfabet. Pusty variantId = produkt bez wariantów.
const ID_RE = /^[A-Za-z0-9._-]{1,128}$/

export const isValidProductId = (id: unknown): id is string =>
  typeof id === 'string' && ID_RE.test(id) && !id.startsWith('drafts.')

const isValidVariantId = (id: unknown): id is string =>
  typeof id === 'string' && (id === '' || ID_RE.test(id))

export const lineKey = (l: Pick<CartLine, 'productId' | 'variantId'>) =>
  `${l.productId}::${l.variantId}`

/**
 * Normalizuje dowolny (niezaufany) payload do poprawnej listy pozycji:
 * odrzuca śmieci, przycina ilości do [1, MAX_LINE_QTY], skleja duplikaty
 * (suma w obrębie jednego źródła) i ogranicza liczbę pozycji.
 * Kolejność pierwszego wystąpienia zostaje zachowana.
 */
export function sanitizeCartLines(input: unknown): CartLine[] {
  if (!Array.isArray(input)) return []
  const byKey = new Map<string, CartLine>()

  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const { productId, variantId, qty } = raw as Record<string, unknown>
    if (!isValidProductId(productId)) continue
    const variant = variantId == null ? '' : variantId
    if (!isValidVariantId(variant)) continue
    const n = typeof qty === 'number' ? Math.floor(qty) : NaN
    if (!Number.isFinite(n) || n < 1) continue

    const key = lineKey({ productId, variantId: variant })
    const prev = byKey.get(key)
    if (prev) {
      prev.qty = Math.min(MAX_LINE_QTY, prev.qty + n)
    } else {
      if (byKey.size >= MAX_CART_LINES) continue
      byKey.set(key, { productId, variantId: variant, qty: Math.min(MAX_LINE_QTY, n) })
    }
  }
  return [...byKey.values()]
}

/**
 * Scala koszyk konta z koszykiem gościa.
 *
 * Przy konflikcie (ten sam produkt + wariant) bierzemy WIĘKSZĄ ilość, a nie sumę.
 * Scalanie jest dzięki temu idempotentne: ponowienie żądania (retry sieci, druga
 * karta, podwójny mount w StrictMode) nie podwaja ilości. Pozycje konta idą
 * pierwsze, nowe pozycje gościa są dopisywane na końcu.
 */
export function mergeCartLines(primary: CartLine[], secondary: CartLine[]): CartLine[] {
  const out = new Map<string, CartLine>()
  for (const l of primary) out.set(lineKey(l), { ...l })
  for (const l of secondary) {
    const key = lineKey(l)
    const prev = out.get(key)
    if (prev) prev.qty = Math.max(prev.qty, l.qty)
    else if (out.size < MAX_CART_LINES) out.set(key, { ...l })
  }
  return [...out.values()]
}

export function sanitizeWishlistIds(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of input) {
    if (!isValidProductId(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= MAX_WISHLIST_SIZE) break
  }
  return out
}

/** Suma zbiorów z zachowaniem kolejności: najpierw konto, potem gość. */
export function mergeWishlistIds(primary: string[], secondary: string[]): string[] {
  return sanitizeWishlistIds([...primary, ...secondary])
}

type ProductLike = {
  _id:       string
  stock?:    number | null
  variants?: Array<{ _key: string; stock?: number | null }> | null
}

/**
 * Odrzuca pozycje, których nie da się już kupić w tej postaci: produkt zniknął
 * z katalogu albo wariant został usunięty. Ilość przycina do znanego stanu
 * magazynu (stan 0 zostawiamy — koszyk pokaże produkt, a checkout i tak
 * waliduje dostępność po stronie serwera).
 */
export function reconcileWithCatalog<P extends ProductLike>(
  lines: CartLine[],
  products: P[],
): Array<CartLine & { product: P }> {
  const byId = new Map(products.map(p => [p._id, p]))
  const out: Array<CartLine & { product: P }> = []

  for (const line of lines) {
    const product = byId.get(line.productId)
    if (!product) continue

    const variants = product.variants ?? []
    let stock: number | null | undefined = product.stock
    if (variants.length) {
      const v = variants.find(x => x._key === line.variantId)
      if (!v) continue
      stock = v.stock ?? stock
    } else if (line.variantId !== '') {
      continue
    }

    const qty = typeof stock === 'number' && stock > 0 ? Math.min(line.qty, stock) : line.qty
    out.push({ ...line, qty, product })
  }
  return out
}
