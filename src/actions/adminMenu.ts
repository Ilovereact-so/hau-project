'use server'

import { revalidatePath } from 'next/cache'
import { runAdminAction, type ActionResult } from '@/lib/admin/guard'
import { getMenuEditorData, saveMenuLayout, type MenuEditorData } from '@/lib/admin/menu'

/** Produkty → Menu sklepu: zapis kolejności i ukrycia. Zwraca świeży stan z Sanity. */
export async function adminSaveMenu(layout: unknown): Promise<ActionResult<{ data: MenuEditorData; changed: number }>> {
  return runAdminAction(async () => {
    const changed = await saveMenuLayout(layout)
    if (changed) {
      // Navbar (cache 10 min), strony kategorii i strona główna — od razu.
      revalidatePath('/', 'layout')
    }
    return { data: await getMenuEditorData(), changed }
  }, 'Nie udało się zapisać menu.')
}
