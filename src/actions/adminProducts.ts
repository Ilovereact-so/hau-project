'use server'

import { revalidatePath } from 'next/cache'
import {
  addProductImage,
  assertDocId,
  createProductDraft,
  deleteDocument,
  invalidateCatalogCache,
  listAdminProducts,
  listCategoryOptions,
  makeImagePrimary,
  publishDocument,
  removeProductImage,
  removeSubcategoryImage,
  renameTaxonomy,
  setProductFlag,
  setStock,
  setSubcategoryImage,
  setVariantPrice,
  unpublishDocument,
  updateProduct,
  validateProductInput,
  type AdminProduct,
  type ProductInput,
} from '@/lib/admin/catalog'
import { runAdminAction, requireAdmin, type ActionResult } from '@/lib/admin/guard'
import { listCollectionOptions, resolveProductCollections } from '@/lib/admin/collections'
import {
  getOmnibusForProducts,
  listPriceHistory,
  recordPriceChanges,
  syncProductPrices,
  type AdminPriceHistory,
} from '@/lib/priceHistory'

/*
 * Akcje katalogu (Sanity) dla panelu admina. Każda sprawdza rolę admina
 * i zwraca `{ ok, data | error }` — komunikat błędu trafia do UI także na
 * produkcji (Next maskuje treść rzuconych wyjątków).
 */

function refreshCatalogViews() {
  revalidatePath('/admin', 'layout')
}

// Typ `AdminProduct` importuj z '@/lib/admin/catalog' — plik 'use server'
// nie może re-eksportować typów (Next zamienia każdy eksport na referencję
// w runtime → „AdminProduct is not defined”).

export async function adminGetProducts(): Promise<AdminProduct[]> {
  await requireAdmin()
  return listAdminProducts()
}

export async function adminRefreshProducts(): Promise<ActionResult<AdminProduct[]>> {
  return runAdminAction(async () => {
    await invalidateCatalogCache()
    const products = await listAdminProducts({ fresh: true })
    refreshCatalogViews()
    return products
  }, 'Nie udało się odświeżyć katalogu.')
}

export async function adminGetCategoryOptions() {
  return runAdminAction(async () => {
    const [taxonomy, collections] = await Promise.all([listCategoryOptions(), listCollectionOptions()])
    return { ...taxonomy, collections }
  }, 'Nie udało się pobrać kategorii.')
}

export async function adminCreateProduct(input: ProductInput): Promise<ActionResult<string>> {
  return runAdminAction(async () => {
    // Walidacja produktu PRZED utworzeniem brakujących kolekcji — błędny
    // formularz nie może zostawić po sobie osieroconych szkiców kolekcji.
    validateProductInput(input)
    const collections = await resolveProductCollections(input)
    const id = await createProductDraft(input, collections)
    refreshCatalogViews()
    return id
  }, 'Nie udało się dodać produktu.')
}

export async function adminUpdateProduct(id: string, input: ProductInput): Promise<ActionResult> {
  return runAdminAction(async () => {
    validateProductInput(input)
    const collections = await resolveProductCollections(input)
    await updateProduct(id, input, collections)
    // Rejestr najniższej ceny z 30 dni — zmiana ceny zapisana od razu.
    await recordPriceChanges([id], 'admin')
    refreshCatalogViews()
    return null
  }, 'Nie udało się zapisać produktu.')
}

export async function adminSetPublished(id: string, published: boolean): Promise<ActionResult> {
  return runAdminAction(async () => {
    if (published) await publishDocument(id)
    else await unpublishDocument(id)
    // Publikacja otwiera ceny w rejestrze, wycofanie je zamyka.
    await recordPriceChanges([id], 'admin')
    refreshCatalogViews()
    return null
  }, published ? 'Nie udało się opublikować produktu.' : 'Nie udało się wycofać produktu.')
}

export async function adminDeleteProduct(id: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await deleteDocument(id)
    await recordPriceChanges([id], 'admin')
    refreshCatalogViews()
    return null
  }, 'Nie udało się usunąć produktu.')
}

/** Ustawia stan wariantu (albo produktu bez wariantów, gdy `variantKey` = null). */
export async function adminUpdateVariantStock(id: string, variantKey: string | null, stock: number): Promise<ActionResult> {
  return runAdminAction(async () => {
    await setStock(id, variantKey, stock)
    refreshCatalogViews()
    return null
  }, 'Nie udało się zapisać stanu magazynowego.')
}

export async function adminUpdateVariantPrice(id: string, variantKey: string, price: number | null): Promise<ActionResult> {
  return runAdminAction(async () => {
    await setVariantPrice(id, variantKey, price)
    await recordPriceChanges([id], 'admin')
    refreshCatalogViews()
    return null
  }, 'Nie udało się zapisać ceny wariantu.')
}

export async function adminToggleProductFlag(
  id: string,
  field: 'isFeatured' | 'isBestseller',
  value: boolean
): Promise<ActionResult> {
  return runAdminAction(async () => {
    if (field !== 'isFeatured' && field !== 'isBestseller') throw new Error('Nieznana flaga.')
    await setProductFlag(id, field, value)
    refreshCatalogViews()
    return null
  }, 'Nie udało się zapisać flagi.')
}

export async function adminUploadProductImage(formData: FormData): Promise<ActionResult<{ key: string; url: string }>> {
  return runAdminAction(async () => {
    const id = String(formData.get('productId') ?? '')
    const alt = String(formData.get('alt') ?? '')
    const file = formData.get('file')
    if (!(file instanceof File)) throw new Error('Nie wybrano pliku.')
    const image = await addProductImage(id, file, alt)
    refreshCatalogViews()
    return image
  }, 'Nie udało się wgrać zdjęcia.')
}

export async function adminRemoveProductImage(id: string, imageKey: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await removeProductImage(id, imageKey)
    refreshCatalogViews()
    return null
  }, 'Nie udało się usunąć zdjęcia.')
}

export async function adminMakeImagePrimary(id: string, imageKey: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await makeImagePrimary(id, imageKey)
    refreshCatalogViews()
    return null
  }, 'Nie udało się ustawić zdjęcia głównego.')
}

/** Historia cen produktu (rejestr najniższej ceny z 30 dni). Typ: `AdminPriceHistory` z '@/lib/priceHistory'. */
export async function adminGetPriceHistory(id: string): Promise<ActionResult<AdminPriceHistory>> {
  return runAdminAction(async () => {
    const productId = assertDocId(id)
    const [entries, omnibus] = await Promise.all([
      listPriceHistory(productId, 100),
      getOmnibusForProducts([productId]),
    ])
    return { entries, omnibus: omnibus[productId] ?? {} }
  }, 'Nie udało się pobrać historii cen.')
}

/** Ręczne uzgodnienie rejestru cen produktu z Sanity. */
export async function adminResyncPriceHistory(id: string): Promise<ActionResult<{ changed: boolean }>> {
  return runAdminAction(async () => {
    const productId = assertDocId(id)
    const result = await syncProductPrices([productId], 'admin')
    if (result.failed.length) throw new Error('Nie udało się zapisać historii cen.')
    return { changed: result.changed > 0 }
  }, 'Nie udało się uzgodnić cen.')
}

/** Odświeża cache listy produktów (po importach). */
export async function adminInvalidateProductsCache() {
  await requireAdmin()
  await invalidateCatalogCache()
}

// ─── kategorie ────────────────────────────────────────────────────────────────

export async function adminRenameTaxonomy(id: string, title: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await renameTaxonomy(id, title)
    refreshCatalogViews()
    return null
  }, 'Nie udało się zapisać nazwy.')
}

export async function adminUploadSubcategoryImage(formData: FormData): Promise<ActionResult<string>> {
  return runAdminAction(async () => {
    const id = String(formData.get('subcategoryId') ?? '')
    const alt = String(formData.get('alt') ?? '')
    const file = formData.get('file')
    if (!(file instanceof File)) throw new Error('Nie wybrano pliku.')
    const url = await setSubcategoryImage(id, file, alt)
    refreshCatalogViews()
    return url
  }, 'Nie udało się wgrać zdjęcia.')
}

export async function adminRemoveSubcategoryImage(id: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await removeSubcategoryImage(id)
    refreshCatalogViews()
    return null
  }, 'Nie udało się usunąć zdjęcia.')
}
