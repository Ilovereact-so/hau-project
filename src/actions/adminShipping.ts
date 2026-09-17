'use server'

import { revalidatePath } from 'next/cache'
import {
  createShippingMethod,
  deleteDocument,
  publishDocument,
  setShippingActive,
  updateShippingMethod,
  type ShippingInput,
} from '@/lib/admin/catalog'
import { runAdminAction, type ActionResult } from '@/lib/admin/guard'
import { syncDeliveryServicesFromFurgonetka } from '@/actions/deliveryServices'

function refresh() {
  revalidatePath('/admin/shipping')
}

export async function adminCreateShippingMethod(input: ShippingInput): Promise<ActionResult<string>> {
  return runAdminAction(async () => {
    const id = await createShippingMethod(input)
    refresh()
    return id
  }, 'Nie udało się dodać metody dostawy.')
}

export async function adminUpdateShippingMethod(id: string, input: ShippingInput): Promise<ActionResult> {
  return runAdminAction(async () => {
    await updateShippingMethod(id, input)
    refresh()
    return null
  }, 'Nie udało się zapisać metody dostawy.')
}

export async function adminSetShippingActive(id: string, active: boolean): Promise<ActionResult> {
  return runAdminAction(async () => {
    await setShippingActive(id, active)
    refresh()
    return null
  }, 'Nie udało się przełączyć metody dostawy.')
}

export async function adminPublishShippingMethod(id: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await publishDocument(id)
    refresh()
    return null
  }, 'Nie udało się opublikować metody dostawy.')
}

export async function adminDeleteShippingMethod(id: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await deleteDocument(id)
    refresh()
    return null
  }, 'Nie udało się usunąć metody dostawy.')
}

/** Pobiera listę usług z konta Furgonetki do tabeli pomocniczej. */
export async function adminSyncFurgonetkaServices(): Promise<ActionResult<{ added: number; existing: number }>> {
  return runAdminAction(async () => {
    const result = await syncDeliveryServicesFromFurgonetka()
    if (!result.ok) throw new Error(result.error || 'Synchronizacja z Furgonetką nie powiodła się.')
    refresh()
    return { added: result.added, existing: result.existing }
  }, 'Synchronizacja z Furgonetką nie powiodła się.')
}
