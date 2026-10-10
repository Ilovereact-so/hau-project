'use server'

import { runAdminAction, type ActionResult } from '@/lib/admin/guard'
import { runIntegrationTest } from '@/lib/admin/integrations'
import { connectWithPastedCode, listAddressBook, senderProblems, setPickupAddressId } from '@/lib/furgonetka'

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

/** Wybór adresu odbioru przesyłek z książki adresowej Furgonetki (`null` = domyślny z Furgonetki). */
export async function adminSetFurgonetkaPickup(id: number | null): Promise<ActionResult<null>> {
  return runAdminAction(async () => {
    if (id !== null && (!Number.isInteger(id) || id <= 0)) throw new Error('Nieprawidłowy adres.')
    if (id !== null) {
      const book = await listAddressBook()
      const entry = book.find((item) => item.id === id)
      if (!entry) throw new Error('Tego adresu nie ma już w książce adresowej Furgonetki.')
      const missing = senderProblems(entry)
      if (missing.length) throw new Error(`Ten adres jest niepełny (${missing.join(', ')}) — uzupełnij go w Furgonetce.`)
    }
    await setPickupAddressId(id)
    return null
  }, 'Nie udało się zapisać adresu odbioru.')
}
