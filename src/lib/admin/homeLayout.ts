import 'server-only'
import { sanityClient } from '@/sanity/sanityClient.server'
import { listAdminProducts, listCategoryOptions } from '@/lib/admin/catalog'
import { listCollectionOptions } from '@/lib/admin/collections'
import { freshFetch, getHomeLayout, resolveProductsSection } from '@/lib/homeLayout.server'
import { HOME_LAYOUT_ID, normalizeHomeLayout, type HomeLayoutData, type HomeProductsSection } from '@/lib/homeLayout'
import { primaryImageForVariant } from '@/lib/variantImages'
import { urlFor } from '@/sanity/lib/image'

/*
 * Panel → Marketing → Strona główna. Dokument `homeLayout` zapisujemy od razu
 * jako opublikowany (bez szkicu) — to konfiguracja strony, a panel pokazuje
 * podgląd każdej karuzeli przed zapisem.
 */

const raw = sanityClient.withConfig({ perspective: 'raw', useCdn: false })

export type PickerProduct = {
  id: string
  title: string
  sku: string | null
  imageUrl: string | null
  status: 'published' | 'changed' | 'draft'
  isFeatured: boolean
  isBestseller: boolean
  price: number | null
}

export type HomeEditorData = {
  layout: HomeLayoutData
  /** czy dokument już istnieje (inaczej panel pokazuje domyślny układ) */
  saved: boolean
  products: PickerProduct[]
  collections: Array<{ id: string; title: string; status: string }>
  categories: Array<{ id: string; title: string }>
  subcategories: Array<{ id: string; title: string; parentId: string | null }>
}

export async function getHomeEditorData(): Promise<HomeEditorData> {
  const [doc, products, collections, taxonomy] = await Promise.all([
    raw.fetch<{ sections?: unknown; _updatedAt?: string } | null>(`*[_id == $id][0]{ sections, _updatedAt }`, { id: HOME_LAYOUT_ID }),
    listAdminProducts().catch(() => []),
    listCollectionOptions().catch(() => []),
    listCategoryOptions().catch(() => ({ categories: [], subcategories: [] })),
  ])
  return {
    layout: doc ? normalizeHomeLayout(doc) : await getHomeLayout(freshFetch),
    saved: Boolean(doc),
    products: products.map((p) => ({
      id: p.id,
      title: p.title,
      sku: p.sku,
      imageUrl: p.images[0]?.url ?? null,
      status: p.status,
      isFeatured: p.isFeatured,
      isBestseller: p.isBestseller,
      price: p.price,
    })),
    collections,
    categories: taxonomy.categories,
    subcategories: taxonomy.subcategories,
  }
}

export async function saveHomeLayout(input: unknown): Promise<HomeLayoutData> {
  const layout = normalizeHomeLayout(input)
  await raw.createOrReplace({
    _id: HOME_LAYOUT_ID,
    _type: 'homeLayout',
    sections: layout.sections.map((section) => ({ _key: section.key, _type: 'homeSection', ...section })),
  })
  return layout
}

export type PreviewItem = { id: string; title: string; imageUrl: string | null; price: number | null; pinned: boolean; badges: string[] }

/** Dokładnie to, co pokaże sklep (dane opublikowane, bez cache). */
export async function previewHomeSection(input: unknown): Promise<{ items: PreviewItem[]; moreHref: string | null }> {
  const layout = normalizeHomeLayout({ sections: [{ ...(input as object), kind: 'products' }] })
  const section = layout.sections[0] as HomeProductsSection
  const { products, moreHref } = await resolveProductsSection(section, freshFetch)
  return {
    moreHref,
    items: products.map((product) => {
      const image = primaryImageForVariant(product.images, product.variants?.[0]?._key)
      let imageUrl: string | null = null
      try {
        imageUrl = image?.asset ? urlFor(image).width(160).height(160).fit('crop').url() : null
      } catch {
        imageUrl = null
      }
      return {
        id: product._id,
        title: product.title ?? '(bez nazwy)',
        imageUrl,
        price: typeof product.price === 'number' ? product.price : product.variants?.[0]?.price ?? null,
        pinned: section.pinnedIds.includes(product._id),
        badges: [product.isFeatured ? 'Promowany' : null, product.isBestseller ? 'Bestseller' : null].filter(
          (badge): badge is string => Boolean(badge),
        ),
      }
    }),
  }
}
