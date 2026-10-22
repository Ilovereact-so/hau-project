'use server'

import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin, runAdminAction, type ActionResult } from '@/lib/admin/guard'
import {
  audienceSize,
  cancelCampaign,
  createCampaign,
  deleteCampaign,
  duplicateCampaign,
  failedRecipients,
  getCampaign,
  pauseCampaign,
  previewCampaign,
  processCampaigns,
  resumeCampaign,
  sendTestCampaign,
  sendingUsage,
  startCampaign,
  unscheduleCampaign,
  updateCampaign,
  type AdminCampaign,
  type CampaignInput,
  type CampaignProgress,
  type StartResult,
} from '@/lib/campaigns/campaigns.server'

/*
 * Kampanie newslettera — akcje panelu (Marketing → Kampanie). Typy
 * importuj z '@/lib/campaigns/campaigns.server' (plik 'use server'
 * nie może re-eksportować typów).
 */

const refresh = () => revalidatePath('/admin/campaigns', 'layout')

/** Po starcie wysyłka idzie w tle (po odpowiedzi); dalej pilnuje jej panel i zadanie cykliczne. */
const kickSending = () =>
  after(() =>
    processCampaigns({ budgetMs: 240_000 }).catch((err) => console.error('[campaigns] wysyłka w tle', err)),
  )

export async function adminCreateCampaign(): Promise<ActionResult<string>> {
  return runAdminAction(async () => {
    const { userId } = await requireAdmin()
    const id = await createCampaign(userId)
    refresh()
    return id
  }, 'Nie udało się utworzyć kampanii.')
}

export async function adminSaveCampaign(id: string, input: CampaignInput): Promise<ActionResult<AdminCampaign>> {
  return runAdminAction(async () => {
    const saved = await updateCampaign(id, input)
    refresh()
    return saved
  }, 'Nie udało się zapisać kampanii.')
}

export async function adminPreviewCampaign(
  input: CampaignInput,
): Promise<ActionResult<{ html: string; text: string; subject: string; missingProducts: number; problems: string[] }>> {
  return runAdminAction(() => previewCampaign(input), 'Nie udało się przygotować podglądu.')
}

export async function adminSendTestCampaign(input: CampaignInput, to: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await sendTestCampaign(input, to)
    return null
  }, 'Nie udało się wysłać maila testowego.')
}

export async function adminStartCampaign(id: string, input: CampaignInput, scheduledAt?: string | null): Promise<ActionResult<StartResult>> {
  return runAdminAction(async () => {
    const result = await startCampaign(id, input, scheduledAt)
    if (result.status === 'sending') kickSending()
    refresh()
    return result
  }, 'Nie udało się uruchomić wysyłki.')
}

export async function adminCampaignAction(
  id: string,
  action: 'pause' | 'resume' | 'cancel' | 'unschedule',
): Promise<ActionResult> {
  return runAdminAction(async () => {
    if (action === 'pause') await pauseCampaign(id)
    else if (action === 'resume') {
      await resumeCampaign(id)
      kickSending()
    } else if (action === 'cancel') await cancelCampaign(id)
    else if (action === 'unschedule') await unscheduleCampaign(id)
    else throw new Error('Nieznana akcja.')
    refresh()
    return null
  }, 'Nie udało się zmienić stanu kampanii.')
}

export async function adminDuplicateCampaign(id: string): Promise<ActionResult<string>> {
  return runAdminAction(async () => {
    const { userId } = await requireAdmin()
    const copy = await duplicateCampaign(id, userId)
    refresh()
    return copy
  }, 'Nie udało się skopiować kampanii.')
}

export async function adminDeleteCampaign(id: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await deleteCampaign(id)
    refresh()
    return null
  }, 'Nie udało się usunąć kampanii.')
}

/**
 * Postęp wysyłki dla otwartego panelu. Przy okazji wysyła kolejną krótką
 * partię — dzięki temu kampania idzie dalej, nawet gdy na hostingu nie ma
 * zadania cyklicznego (blokada w Redisie nie dopuści do podwójnej wysyłki).
 */
export async function adminCampaignProgress(id: string, drive = true): Promise<ActionResult<CampaignProgress>> {
  return runAdminAction(async () => {
    if (drive) await processCampaigns({ budgetMs: 12_000 })
    const [campaign, usage, failures] = await Promise.all([getCampaign(id), sendingUsage(), failedRecipients(id, 20)])
    return { campaign, usage, failures }
  }, 'Nie udało się pobrać postępu wysyłki.')
}

export async function adminCampaignAudience(): Promise<ActionResult<number>> {
  return runAdminAction(() => audienceSize(), 'Nie udało się policzyć odbiorców.')
}
