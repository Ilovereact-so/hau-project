import 'server-only'
import { listAdminProducts } from '@/lib/admin/catalog'
import { listAdminGuides, listGuideCategories } from '@/lib/admin/guides'
import type { EditorCategory, EditorGuideLink, EditorProduct } from '@/components/admin/blog/shared'
import { effectivePrice } from '@/lib/omnibus'

/**
 * Dane pomocnicze edytora: kategorie, katalog (ramka „Polecane produkty”
 * i wyszukiwarka linków) oraz lista artykułów (linki między poradnikami).
 * Awaria katalogu nie blokuje pisania — edytor dostaje wtedy pustą listę.
 */
export async function loadEditorData(): Promise<{
  categories: EditorCategory[]
  products: EditorProduct[]
  guides: EditorGuideLink[]
  warning?: string
}> {
  const [categories, products, guides] = await Promise.allSettled([listGuideCategories(), listAdminProducts(), listAdminGuides()])
  const warnings: string[] = []
  if (categories.status === 'rejected') warnings.push('kategorii')
  if (products.status === 'rejected') warnings.push('katalogu produktów')
  if (guides.status === 'rejected') warnings.push('listy artykułów')

  return {
    categories:
      categories.status === 'fulfilled'
        ? categories.value.map((category) => ({ id: category.id, title: category.title, slug: category.slug }))
        : [],
    products:
      products.status === 'fulfilled'
        ? products.value.map((product) => ({
            id: product.id,
            title: product.title,
            subtitle: product.subtitle,
            sku: product.sku,
            slug: product.slug,
            // Ta sama cena co na kafelku sklepu: pierwszy wariant → produkt.
            price: effectivePrice(
              { price: product.price, variants: product.variants.map((variant) => ({ _key: variant.key, price: variant.price })) },
              product.variants[0]?.key ?? null,
            ),
            imageUrl: product.images[0]?.url ?? null,
            status: product.status,
          }))
        : [],
    guides:
      guides.status === 'fulfilled'
        ? guides.value.map((guide) => ({ id: guide.id, title: guide.title, slug: guide.slug, status: guide.status }))
        : [],
    warning: warnings.length ? `Nie udało się pobrać: ${warnings.join(', ')}. Pisanie działa, ale część podpowiedzi jest pusta.` : undefined,
  }
}
