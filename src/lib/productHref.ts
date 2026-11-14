/**
 * Adres karty produktu. `?variant=` doklejamy tylko wtedy, gdy produkt ma
 * wariant — produkt bez wariantów (np. miska w jednym kolorze, parametry
 * tylko do filtrowania) dostaje czysty `/product/<slug>`, a nie
 * `?variant=undefined`.
 */
export function productHref(slug: string | null | undefined, variantKey?: string | null, hash?: string): string {
  if (!slug) return '/'
  const query = variantKey ? `?variant=${encodeURIComponent(variantKey)}` : ''
  return `/product/${slug}${query}${hash ? `#${hash}` : ''}`
}
