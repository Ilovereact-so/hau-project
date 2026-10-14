import type { MetadataRoute } from 'next'
import { getSitemapData } from '@/sanity/helpers'
import { absoluteUrl } from '@/lib/site'
import { isProductCategory } from '@/lib/categoryNavigation'
import { WITHDRAWAL_PATH } from '@/lib/withdrawals'

/**
 * Mapa strony: sekcje stałe + wszystko, co admin dodaje w Sanity
 * (produkty, kategorie, subkategorie, kolekcje, poradniki, dokumenty pomocy).
 * Odświeżana co godzinę — nowy produkt trafia do mapy sam.
 */
export const revalidate = 3600

const date = (value?: string | null) => {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await getSitemapData()

  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/kolekcje'), changeFrequency: 'weekly', priority: 0.7 },
    { url: absoluteUrl('/poradniki'), changeFrequency: 'weekly', priority: 0.6 },
    { url: absoluteUrl('/help'), changeFrequency: 'monthly', priority: 0.4 },
    { url: absoluteUrl(WITHDRAWAL_PATH), changeFrequency: 'yearly', priority: 0.3 },
  ]

  const products: MetadataRoute.Sitemap = data.products.map((entry) => ({
    url: absoluteUrl(`/product/${entry.slug}`),
    lastModified: date(entry.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  // Kategorie główne (bez „Poradników” — to nie kategoria sklepu).
  const categories: MetadataRoute.Sitemap = (data.categories ?? [])
    .filter((entry) => isProductCategory({ slug: entry.slug }))
    .map((entry) => ({
      url: absoluteUrl(`/category/${entry.slug}`),
      lastModified: date(entry.updatedAt),
      changeFrequency: 'daily',
      priority: 0.9,
    }))

  const subcategories: MetadataRoute.Sitemap = data.subcategories.map((entry) => ({
    url: absoluteUrl(`/subcategory/${entry.slug}`),
    lastModified: date(entry.updatedAt),
    changeFrequency: 'daily',
    priority: 0.9,
  }))

  const collections: MetadataRoute.Sitemap = data.collections.map((entry) => ({
    url: absoluteUrl(`/kolekcje/${entry.slug}`),
    lastModified: date(entry.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  const guides: MetadataRoute.Sitemap = data.guides.map((entry) => ({
    url: absoluteUrl(`/poradniki/${entry.slug}`),
    lastModified: date(entry.updatedAt),
    changeFrequency: 'monthly',
    priority: 0.5,
  }))

  const help: MetadataRoute.Sitemap = data.helpDocuments.map((entry) => ({
    url: absoluteUrl(`/help/${entry.slug}`),
    lastModified: date(entry.updatedAt),
    changeFrequency: 'yearly',
    priority: 0.3,
  }))

  return [...staticPages, ...categories, ...subcategories, ...products, ...collections, ...guides, ...help]
}
