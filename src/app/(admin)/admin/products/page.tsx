import type { Metadata } from 'next'
import { listAdminProducts, listCategoryOptions, type AdminProduct } from '@/lib/admin/catalog'
import { listCollectionOptions } from '@/lib/admin/collections'
import { ProductsView } from '@/components/admin/products/ProductsView'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Produkty' }

export default async function AdminProductsPage() {
  let products: AdminProduct[] = []
  let loadError: string | undefined
  const [productsResult, categoriesResult, collectionsResult] = await Promise.allSettled([
    listAdminProducts(),
    listCategoryOptions(),
    listCollectionOptions(),
  ])

  if (productsResult.status === 'fulfilled') products = productsResult.value
  else loadError = `Nie udało się pobrać katalogu z Sanity: ${(productsResult.reason as Error)?.message ?? 'nieznany błąd'}`

  const categories = {
    ...(categoriesResult.status === 'fulfilled' ? categoriesResult.value : { categories: [], subcategories: [] }),
    // Brak listy kolekcji nie blokuje katalogu — pole w formularzu pozwoli wtedy tylko wpisać nowe.
    collections: collectionsResult.status === 'fulfilled' ? collectionsResult.value : [],
  }

  return <ProductsView products={products} categories={categories} loadError={loadError} />
}
