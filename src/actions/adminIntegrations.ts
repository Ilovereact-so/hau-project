'use server'

import { runAdminAction, type ActionResult } from '@/lib/admin/guard'
import { runIntegrationTest } from '@/lib/admin/integrations'

export async function adminTestIntegration(id: string): Promise<ActionResult<string>> {
  return runAdminAction(() => runIntegrationTest(id), 'Test połączenia nie powiódł się.')
}
