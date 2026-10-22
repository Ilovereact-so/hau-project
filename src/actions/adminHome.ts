'use server'

import { revalidatePath } from 'next/cache'
import { runAdminAction, type ActionResult } from '@/lib/admin/guard'
import { previewHomeSection, saveHomeLayout, saveSocialLinks, type PreviewItem } from '@/lib/admin/homeLayout'
import type { HomeLayoutData } from '@/lib/homeLayout'
import type { SocialLinks } from '@/lib/shopSettings'

export async function adminSaveHomeLayout(layout: Pick<HomeLayoutData, 'sections' | 'about'>): Promise<ActionResult<HomeLayoutData>> {
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

/** Linki do Facebooka, Instagrama i TikToka (stopka + „O nas” na stronie głównej). */
export async function adminSaveSocialLinks(links: Partial<Record<keyof SocialLinks, string>>): Promise<ActionResult<SocialLinks>> {
  return runAdminAction(async () => {
    const saved = await saveSocialLinks(links)
    // Stopka jest na każdej stronie i czyta linki z /api/shop-settings (cache 60 s).
    revalidatePath('/', 'layout')
    revalidatePath('/api/shop-settings')
    return saved
  }, 'Nie udało się zapisać linków do mediów społecznościowych.')
}
