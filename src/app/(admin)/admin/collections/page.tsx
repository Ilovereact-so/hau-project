import type { Metadata } from 'next'
import { listAdminCollections, type AdminCollection } from '@/lib/admin/collections'
import { listAdminProducts } from '@/lib/admin/catalog'
import { requireAdmin } from '@/lib/admin/guard'
import { CollectionsView, type CatalogProductLite } from '@/components/admin/collections/CollectionsView'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kolekcje' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AdminCollectionsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin()
  const sp = await searchParams
  const q = ((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? '').trim()

  const [collectionsResult, productsResult] = await Promise.allSettled([listAdminCollections(), listAdminProducts()])

  let collections: AdminCollection[] = []
  let loadError: string | undefined
  if (collectionsResult.status === 'fulfilled') collections = collectionsResult.value
  else loadError = `Nie udało się pobrać kolekcji z Sanity: ${(collectionsResult.reason as Error)?.message ?? 'nieznany błąd'}`

  // Lekka lista katalogu do wyszukiwarki „dodaj produkt” w oknie kolekcji.
  const catalog: CatalogProductLite[] =
    productsResult.status === 'fulfilled'
      ? productsResult.value.map((product) => ({
          id: product.id,
          title: product.title,
          sku: product.sku,
          imageUrl: product.images[0]?.url ?? null,
          status: product.status,
          collectionIds: product.collectionIds,
        }))
      : []

  return <CollectionsView collections={collections} catalog={catalog} query={q} loadError={loadError} />
}
