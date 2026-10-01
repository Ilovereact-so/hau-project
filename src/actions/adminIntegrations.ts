'use server'

import { runAdminAction, type ActionResult } from '@/lib/admin/guard'
import { runIntegrationTest } from '@/lib/admin/integrations'
import { connectWithPastedCode, setSenderAddress, type FurgonetkaSender } from '@/lib/furgonetka'

export async function adminTestIntegration(id: string): Promise<ActionResult<string>> {
  return runAdminAction(() => runIntegrationTest(id), 'Test połączenia nie powiódł się.')
}

/** Kończy autoryzację Furgonetki z wklejonego adresu przekierowania (albo kodu). */
export async function adminFurgonetkaConnect(input: string): Promise<ActionResult<null>> {
  return runAdminAction(async () => {
    await connectWithPastedCode(String(input ?? '').slice(0, 4000))
    return null
  }, 'Nie udało się połączyć konta Furgonetki.')
}

/** Adres nadawcy przesyłek (pole `pickup` w Furgonetce). */
export async function adminSaveFurgonetkaSender(input: Partial<FurgonetkaSender>): Promise<ActionResult<FurgonetkaSender>> {
  return runAdminAction(() => setSenderAddress(input ?? {}), 'Nie udało się zapisać adresu nadawcy.')
}
