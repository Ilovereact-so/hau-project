import 'server-only'
import { sanityClient } from '@/sanity/sanityClient.server'
import { effectivePrice } from '@/lib/omnibus'
import type { ProductPromotion } from '@/lib/promotion'

/*
 * Ceny pozycji koszyka liczone po stronie serwera z Sanity — jedno źródło dla
 * kasy (`actions/checkout.ts`) i podglądu kodu rabatowego w koszyku, żeby
 * rabat w koszyku i w zamówieniu wychodził z tych samych kwot.
 *
 * Czytamy ŚWIEŻO (bez CDN, perspektywa `published`): kasa sprawdza tu stan
 * magazynu, a CDN potrafi przez chwilę oddawać stan sprzed zdjęcia po
 * poprzednim zamówieniu — klient kupiłby sztukę, której już nie ma.
 */

export interface SanityPricedProduct {
  _id:      string
  title:    string
  price:    number | null
  brand:    string | null
  variants: Array<{ _key: string; price: number | null; stock: number | null }> | null
  stock:    number | null
  promotion: ProductPromotion | null
}

export async function fetchSanityPrices(productIds: string[]): Promise<Map<string, SanityPricedProduct>> {
  if (!productIds.length) return new Map()
  const data = await sanityClient.fetch<SanityPricedProduct[]>(
    `*[_type == "product" && _id in $ids]{ _id, title, price, brand, stock, promotion, variants[]{ _key, price, stock } }`,
    { ids: productIds },
  )
  return new Map(data.map(p => [p._id, p]))
}

// Ta sama reguła co koszyk i rejestr cen (lib/omnibus.ts): cena wariantu,
// a gdy wariant jej nie ma — cena produktu; z aktywną promocją.
export function resolveProductPrice(product: SanityPricedProduct, variantId: string): number | null {
  return effectivePrice(product, variantId || null)
}

/** Wartość produktów w groszach; pozycje bez ceny/nieistniejące są pomijane. */
export async function cartSubtotalCents(
  items: Array<{ productId: string; variantId: string; qty: number }>,
): Promise<number> {
  const prices = await fetchSanityPrices([...new Set(items.map(i => i.productId))])
  let total = 0
  for (const item of items) {
    const product = prices.get(item.productId)
    if (!product) continue
    const price = resolveProductPrice(product, item.variantId)
    if (price === null) continue
    const qty = Math.max(0, Math.min(99, Math.floor(item.qty)))
    total += Math.round(price * 100) * qty
  }
  return total
}
