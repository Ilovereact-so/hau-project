'use server'

import { revalidatePath } from 'next/cache'
import {
  addProductsToCollection,
  assertCollectionPublishable,
  createCollectionDraft,
  deleteCollection,
  listCollectionProducts,
  removeCollectionImage,
  removeProductFromCollection,
  setCollectionImage,
  updateCollection,
  type CollectionInput,
  type CollectionProduct,
} from '@/lib/admin/collections'
import { publishDocument, unpublishDocument } from '@/lib/admin/catalog'
import { runAdminAction, type ActionResult } from '@/lib/admin/guard'

/*
 * Akcje zakładki „Kolekcje” w panelu. Każda sprawdza rolę admina
 * (runAdminAction) i zwraca wynik zamiast rzucać.
 */

function refresh() {
  revalidatePath('/admin', 'layout')
  // Strony sklepu czytają Sanity z cache 60 s (tagi sanity:* unieważnia SanityLive).
  revalidatePath('/kolekcje', 'layout')
}

export async function adminCreateCollection(input: CollectionInput): Promise<ActionResult<string>> {
  return runAdminAction(async () => {
    const id = await createCollectionDraft(input)
    refresh()
    return id
  }, 'Nie udało się utworzyć kolekcji.')
}

export async function adminUpdateCollection(id: string, input: CollectionInput): Promise<ActionResult> {
  return runAdminAction(async () => {
    await updateCollection(id, input)
    refresh()
    return null
  }, 'Nie udało się zapisać kolekcji.')
}

export async function adminSetCollectionPublished(id: string, published: boolean): Promise<ActionResult> {
  return runAdminAction(async () => {
    if (published) {
      await assertCollectionPublishable(id)
      await publishDocument(id)
    } else {
      await unpublishDocument(id)
    }
    refresh()
    return null
  }, published ? 'Nie udało się opublikować kolekcji.' : 'Nie udało się wycofać kolekcji.')
}

export async function adminDeleteCollection(id: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await deleteCollection(id)
    refresh()
    return null
  }, 'Nie udało się usunąć kolekcji.')
}

export async function adminGetCollectionProducts(id: string): Promise<ActionResult<CollectionProduct[]>> {
  return runAdminAction(() => listCollectionProducts(id), 'Nie udało się pobrać produktów kolekcji.')
}

export async function adminAddProductsToCollection(id: string, productIds: string[]): Promise<ActionResult<number>> {
  return runAdminAction(async () => {
    if (!Array.isArray(productIds)) throw new Error('Nieprawidłowa lista produktów.')
    const count = await addProductsToCollection(id, productIds)
    refresh()
    return count
  }, 'Nie udało się dodać produktów do kolekcji.')
}

export async function adminRemoveProductFromCollection(id: string, productId: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await removeProductFromCollection(id, productId)
    refresh()
    return null
  }, 'Nie udało się usunąć produktu z kolekcji.')
}

export async function adminUploadCollectionImage(formData: FormData): Promise<ActionResult<string>> {
  return runAdminAction(async () => {
    const id = String(formData.get('collectionId') ?? '')
    const alt = String(formData.get('alt') ?? '')
    const file = formData.get('file')
    if (!(file instanceof File)) throw new Error('Nie wybrano pliku.')
    const url = await setCollectionImage(id, file, alt)
    refresh()
    return url
  }, 'Nie udało się wgrać zdjęcia.')
}

export async function adminRemoveCollectionImage(id: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await removeCollectionImage(id)
    refresh()
    return null
  }, 'Nie udało się usunąć zdjęcia.')
}
