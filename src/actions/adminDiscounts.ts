'use server'

import { revalidatePath } from 'next/cache'
import { runAdminAction, type ActionResult } from '@/lib/admin/guard'
import {
  deleteDiscountCode,
  saveDiscountCode,
  setDiscountCodeActive,
  type DiscountCodeInput,
} from '@/lib/admin/discounts'

function refresh() {
  revalidatePath('/admin/discounts')
}

export async function adminSaveDiscountCode(input: DiscountCodeInput): Promise<ActionResult<{ id: string }>> {
  return runAdminAction(async () => {
    const result = await saveDiscountCode(input)
    refresh()
    return result
  }, 'Nie udało się zapisać kodu.')
}

export async function adminSetDiscountCodeActive(id: string, isActive: boolean): Promise<ActionResult> {
  return runAdminAction(async () => {
    await setDiscountCodeActive(String(id), Boolean(isActive))
    refresh()
    return null
  }, 'Nie udało się zmienić kodu.')
}

export async function adminDeleteDiscountCode(id: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    await deleteDiscountCode(String(id))
    refresh()
    return null
  }, 'Nie udało się usunąć kodu.')
}
