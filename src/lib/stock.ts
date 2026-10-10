/*
 * Stany magazynowe — czysta logika wspólna dla sklepu (kafelki, przycisk
 * „Dodaj do koszyka”, koszyk), kasy (walidacja zamówienia) i panelu.
 *
 * Stan wariantu = `variants[].stock`, a gdy wariant go nie ma — `stock`
 * produktu. Brak liczby w obu miejscach (`null`) = stan nieprowadzony:
 * produkt traktujemy jako dostępny (tak działał sklep przed wprowadzeniem
 * kontroli stanów i tak zachowują się produkty dodane bez ilości).
 */

/** Maks. sztuk jednej pozycji w koszyku (to samo co `cartMerge`). */
export const MAX_LINE_QTY = 99

/**
 * Próg „niskiego stanu” w panelu: pokazujemy warianty z 1 sztuką albo bez
 * towaru (stan < 2). W sklepie stany są z natury niskie, więc wyższy próg
 * zaznaczał prawie cały katalog.
 */
export const LOW_STOCK_THRESHOLD = 2

type StockProduct = {
  stock?: number | null
  variants?: Array<{ _key?: string | null; stock?: number | null } | null> | null
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** Stan wariantu (szt.) albo `null`, gdy stan nie jest prowadzony. */
export function variantStock(product: StockProduct | null | undefined, variantKey?: string | null): number | null {
  if (!product) return null
  if (variantKey) {
    const variant = product.variants?.find((v) => v?._key === variantKey)
    if (variant && isCount(variant.stock)) return Math.max(0, Math.floor(variant.stock))
  }
  return isCount(product.stock) ? Math.max(0, Math.floor(product.stock)) : null
}

export function isVariantAvailable(product: StockProduct | null | undefined, variantKey?: string | null): boolean {
  const stock = variantStock(product, variantKey)
  return stock === null || stock > 0
}

/** Czy da się kupić jakikolwiek wariant produktu. */
export function isProductAvailable(product: StockProduct | null | undefined): boolean {
  if (!product) return false
  const keys = (product.variants ?? []).map((v) => v?._key).filter((key): key is string => Boolean(key))
  if (!keys.length) return isVariantAvailable(product, null)
  return keys.some((key) => isVariantAvailable(product, key))
}

/** Ile sztuk wariantu można mieć w koszyku (0 = niedostępny). */
export function maxOrderQty(product: StockProduct | null | undefined, variantKey?: string | null): number {
  const stock = variantStock(product, variantKey)
  return stock === null ? MAX_LINE_QTY : Math.min(MAX_LINE_QTY, stock)
}

/** Niski stan w panelu (0 albo 1 szt.). `null` (nieprowadzony) nie jest niski. */
export function isLowStock(stock: number | null | undefined): boolean {
  return isCount(stock) && stock < LOW_STOCK_THRESHOLD
}
