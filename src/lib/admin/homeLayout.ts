import 'server-only'
import { sanityClient } from '@/sanity/sanityClient.server'
import { listAdminProducts, listCategoryOptions, uploadImageAsset } from '@/lib/admin/catalog'
import { listCollectionOptions } from '@/lib/admin/collections'
import { HOME_LAYOUT_PROJECTION, freshFetch, getHomeLayout, resolveProductsSection } from '@/lib/homeLayout.server'
import { HOME_LAYOUT_ID, normalizeHomeLayout, type HomeLayoutData, type HomeProductsSection } from '@/lib/homeLayout'
import { SHOP_SETTINGS_ID, normalizeSocialLinks, normalizeSocialUrl, SOCIAL_NETWORKS, type SocialLinks } from '@/lib/shopSettings'
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
  /** Linki do profili sklepu (dokument `shopSettings`). */
  social: SocialLinks
}

export async function getHomeEditorData(): Promise<HomeEditorData> {
  const [doc, products, collections, taxonomy, settings] = await Promise.all([
    raw.fetch<{ sections?: unknown; _updatedAt?: string } | null>(`*[_id == $id][0]{ ${HOME_LAYOUT_PROJECTION} }`, { id: HOME_LAYOUT_ID }),
    listAdminProducts().catch(() => []),
    listCollectionOptions().catch(() => []),
    listCategoryOptions().catch(() => ({ categories: [], subcategories: [] })),
    raw
      .fetch<{ socialFacebook?: string; socialInstagram?: string; socialTiktok?: string } | null>(
        `*[_id == $id][0]{ socialFacebook, socialInstagram, socialTiktok }`,
        { id: SHOP_SETTINGS_ID },
      )
      .catch(() => null),
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
    social: normalizeSocialLinks({
      facebook: settings?.socialFacebook,
      instagram: settings?.socialInstagram,
      tiktok: settings?.socialTiktok,
    }),
  }
}

export async function saveHomeLayout(input: unknown): Promise<HomeLayoutData> {
  const layout = normalizeHomeLayout(input)
  const { dogImage, ...about } = layout.about
  await raw.createOrReplace({
    _id: HOME_LAYOUT_ID,
    _type: 'homeLayout',
    sections: layout.sections.map((section) => ({ _key: section.key, _type: 'homeSection', ...section })),
    about: {
      _type: 'object',
      ...about,
      ...(dogImage
        ? { dogImage: { _type: 'image', asset: { _type: 'reference', _ref: dogImage.assetId }, alt: dogImage.alt } }
        : {}),
    },
  })
  // Adres zdjęcia do podglądu (zapis zna tylko asset id).
  const saved = await raw.fetch<unknown>(`*[_id == $id][0]{ ${HOME_LAYOUT_PROJECTION} }`, { id: HOME_LAYOUT_ID }).catch(() => null)
  return saved ? normalizeHomeLayout(saved) : layout
}

/** Zdjęcie do sekcji „O nas” — trafia do zasobów Sanity, zapis w układzie dopiero po „Zapisz”. */
export async function uploadHomeImage(file: File): Promise<{ assetId: string; url: string }> {
  const asset = await uploadImageAsset(file)
  return { assetId: asset._id, url: asset.url }
}

/**
 * Linki do profili sklepu (Facebook, Instagram, TikTok) — `shopSettings`,
 * od razu w wersji opublikowanej (stopka i strona główna czytają je bez szkiców).
 * Nieprawidłowy link (inna domena) = błąd z nazwą serwisu, nie cichy brak.
 */
export async function saveSocialLinks(input: Partial<Record<string, unknown>>): Promise<SocialLinks> {
  const links = {} as SocialLinks
  for (const network of SOCIAL_NETWORKS) {
    const value = String(input?.[network] ?? '').trim()
    const url = normalizeSocialUrl(network, value)
    if (value && !url) {
      const name = network === 'facebook' ? 'Facebooka' : network === 'instagram' ? 'Instagrama' : 'TikToka'
      throw new Error(`Link do ${name} jest nieprawidłowy — wklej adres profilu, np. https://www.${network}.com/…`)
    }
    links[network] = url
  }
  const set: Record<string, string> = {}
  const unset: string[] = []
  const fields: Record<keyof SocialLinks, string> = { facebook: 'socialFacebook', instagram: 'socialInstagram', tiktok: 'socialTiktok' }
  for (const network of SOCIAL_NETWORKS) {
    if (links[network]) set[fields[network]] = links[network]!
    else unset.push(fields[network])
  }
  await raw.createIfNotExists({ _id: SHOP_SETTINGS_ID, _type: 'shopSettings' })
  await raw.patch(SHOP_SETTINGS_ID).set(set).unset(unset).commit()
  return links
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
        badges: [
          product.isNew ? 'Nowość' : null,
          product.isFeatured ? 'Promowany' : null,
          product.isBestseller ? 'Bestseller' : null,
        ].filter(
          (badge): badge is string => Boolean(badge),
        ),
      }
    }),
  }
}
