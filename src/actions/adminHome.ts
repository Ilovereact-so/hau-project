'use server'

import { revalidatePath } from 'next/cache'
import { runAdminAction, type ActionResult } from '@/lib/admin/guard'
import { previewHomeSection, saveHomeLayout, type PreviewItem } from '@/lib/admin/homeLayout'
import type { HomeLayoutData } from '@/lib/homeLayout'

export async function adminSaveHomeLayout(layout: HomeLayoutData): Promise<ActionResult<HomeLayoutData>> {
  return runAdminAction(async () => {
    const saved = await saveHomeLayout(layout)
    // Strona główna jest cache'owana (ISR) — bez tego zmiana czekałaby do minuty.
    revalidatePath('/')
    revalidatePath('/admin/home')
    return saved
  }, 'Nie udało się zapisać układu strony głównej.')
}

export async function adminPreviewHomeSection(
  section: unknown,
): Promise<ActionResult<{ items: PreviewItem[]; moreHref: string | null }>> {
  return runAdminAction(() => previewHomeSection(section), 'Nie udało się policzyć podglądu.')
}
