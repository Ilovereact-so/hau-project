'use server'

import { revalidatePath } from 'next/cache'
import {
  GuideConflictError,
  createGuide,
  createGuideCategory,
  deleteGuide,
  deleteGuideCategory,
  discardGuideDraft,
  duplicateGuide,
  getGuideForEditor,
  publishGuide,
  saveGuideDraft,
  setGuideFeatured,
  unpublishGuide,
  updateGuideCategory,
  type AdminGuideCategory,
  type GuideCategoryInput,
  type GuideEditorDoc,
  type GuideInput,
  type SaveResult,
} from '@/lib/admin/guides'
import { errorMessage, requireAdmin, runAdminAction, type ActionResult } from '@/lib/admin/guard'

/*
 * Akcje zakładki „Blog” (poradniki). Każda sprawdza rolę admina i zwraca
 * wynik zamiast rzucać — Next maskuje treść wyjątków na produkcji.
 */

function refreshStore(slug?: string | null) {
  revalidatePath('/admin/blog', 'layout')
  // Sklep czyta Sanity z cache 60 s — publikacja ma być widoczna od razu.
  revalidatePath('/poradniki', 'layout')
  if (slug) revalidatePath(`/poradniki/${slug}`)
  revalidatePath('/sitemap.xml')
}

export type SaveGuideResult = ({ ok: true; data: SaveResult } | { ok: false; error: string; conflict?: boolean })

/** Zapis szkicu (ręczny i autozapis). `id === null` = nowy artykuł. */
export async function adminSaveGuide(id: string | null, input: GuideInput, baseRev: string | null): Promise<SaveGuideResult> {
  try {
    await requireAdmin()
    const data = id ? await saveGuideDraft(id, input, baseRev) : await createGuide(input)
    // Szkic nie zmienia sklepu — odświeżamy tylko listę w panelu.
    revalidatePath('/admin/blog', 'layout')
    return { ok: true, data }
  } catch (error) {
    if (error instanceof GuideConflictError) return { ok: false, error: error.message, conflict: true }
    console.error('[admin blog] save', error)
    return { ok: false, error: errorMessage(error, 'Nie udało się zapisać artykułu.') }
  }
}

export async function adminReloadGuide(id: string): Promise<ActionResult<GuideEditorDoc>> {
  return runAdminAction(async () => {
    const doc = await getGuideForEditor(id)
    if (!doc) throw new Error('Artykuł nie istnieje (mógł zostać usunięty).')
    return doc
  }, 'Nie udało się wczytać artykułu.')
}

export async function adminPublishGuide(id: string, slug?: string | null): Promise<ActionResult<{ scheduledFor: string | null }>> {
  return runAdminAction(async () => {
    const result = await publishGuide(id)
    refreshStore(slug)
    return result
  }, 'Nie udało się opublikować artykułu.')
}

export async function adminUnpublishGuide(id: string, slug?: string | null): Promise<ActionResult> {
  return runAdminAction(async () => {
    await unpublishGuide(id)
    refreshStore(slug)
    return null
  }, 'Nie udało się wycofać artykułu.')
}

export async function adminDiscardGuideDraft(id: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await discardGuideDraft(id)
    revalidatePath('/admin/blog', 'layout')
    return null
  }, 'Nie udało się odrzucić zmian.')
}

export async function adminDeleteGuide(id: string, slug?: string | null): Promise<ActionResult> {
  return runAdminAction(async () => {
    await deleteGuide(id)
    refreshStore(slug)
    return null
  }, 'Nie udało się usunąć artykułu.')
}

export async function adminDuplicateGuide(id: string): Promise<ActionResult<string>> {
  return runAdminAction(async () => {
    const newId = await duplicateGuide(id)
    revalidatePath('/admin/blog', 'layout')
    return newId
  }, 'Nie udało się skopiować artykułu.')
}

export async function adminSetGuideFeatured(id: string, featured: boolean): Promise<ActionResult> {
  return runAdminAction(async () => {
    await setGuideFeatured(id, featured)
    refreshStore()
    return null
  }, 'Nie udało się zmienić wyróżnienia.')
}

// Zdjęcia i filmy NIE idą przez server action (na hostingu akcja z plikiem
// potrafiła zawisnąć) — trasy /api/admin/images (target `guide`) i /api/admin/guide-video.

export async function adminCreateGuideCategory(input: GuideCategoryInput): Promise<ActionResult<AdminGuideCategory>> {
  return runAdminAction(async () => {
    const category = await createGuideCategory(input)
    refreshStore()
    return category
  }, 'Nie udało się utworzyć kategorii.')
}

export async function adminUpdateGuideCategory(id: string, input: GuideCategoryInput): Promise<ActionResult> {
  return runAdminAction(async () => {
    await updateGuideCategory(id, input)
    refreshStore()
    return null
  }, 'Nie udało się zapisać kategorii.')
}

export async function adminDeleteGuideCategory(id: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await deleteGuideCategory(id)
    refreshStore()
    return null
  }, 'Nie udało się usunąć kategorii.')
}
