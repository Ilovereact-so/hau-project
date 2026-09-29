import { urlFor } from '@/sanity/lib/image'
import { dataset, projectId } from '@/sanity/env'
import type { EmbedProduct } from '@/components/guides/GuideBlocks'

/*
 * Typy i drobne pomocniki edytora bloga (bez importów serwerowych).
 */

export type EditorProduct = {
  id: string
  title: string
  subtitle: string | null
  sku: string | null
  slug: string | null
  price: number | null
  imageUrl: string | null
  status: 'published' | 'changed' | 'draft'
}

export type EditorGuideLink = { id: string; title: string; slug: string | null; status: 'published' | 'changed' | 'draft' }

export type EditorCategory = { id: string; title: string; slug: string | null }

/** Podgląd obrazu z samej referencji zasobu (`image-<hash>-WxH-ext`). */
export function imageUrlFromRef(ref: string | null | undefined, width = 1200): string | null {
  if (!ref) return null
  try {
    return urlFor({ asset: { _ref: ref } } as Parameters<typeof urlFor>[0]).width(width).fit('max').auto('format').url()
  } catch {
    return null
  }
}

/** Adres pliku z referencji (`file-<hash>-<ext>` → cdn.sanity.io/files/…). */
export function fileUrlFromRef(ref: string | null | undefined): string | null {
  const match = ref?.match(/^file-([A-Za-z0-9]+)-([a-z0-9]+)$/)
  if (!match) return null
  return `https://cdn.sanity.io/files/${projectId}/${dataset}/${match[1]}.${match[2]}`
}

/** Produkty z katalogu w kształcie, który rozumie renderer ramki „Polecane produkty”. */
export function productsForPreview(products: EditorProduct[]): Record<string, EmbedProduct> {
  const map: Record<string, EmbedProduct> = {}
  for (const product of products) {
    map[product.id] = {
      _id: product.id,
      title: product.title,
      subtitle: product.subtitle,
      slug: product.slug,
      price: product.price,
      imageUrl: product.imageUrl,
    }
  }
  return map
}

const polishPlural = (count: number, one: string, few: string, many: string) => {
  if (count === 1) return one
  const last = count % 10
  const lastTwo = count % 100
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many
}

export const wordsLabel = (count: number) => `${count} ${polishPlural(count, 'słowo', 'słowa', 'słów')}`
export const articlesLabel = (count: number) => `${count} ${polishPlural(count, 'artykuł', 'artykuły', 'artykułów')}`

/** `datetime-local` ↔ ISO (strefa przeglądarki — admin pracuje w czasie lokalnym). */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function localInputToIso(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
