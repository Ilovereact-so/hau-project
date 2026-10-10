'use server'

import Papa from 'papaparse'
import { desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { newsletterSubscribers } from '@/db/schema'
import { runAdminAction, type ActionResult } from '@/lib/admin/guard'

/** Lista aktywnych subskrybentów do CSV (import do narzędzia mailingowego). */
export async function adminExportSubscribersCsv(): Promise<ActionResult<{ csv: string; count: number; fileName: string }>> {
  return runAdminAction(async () => {
    const rows = await db
      .select({
        email: newsletterSubscribers.email,
        consentAt: newsletterSubscribers.consentAt,
        confirmedAt: newsletterSubscribers.confirmedAt,
        createdAt: newsletterSubscribers.createdAt,
      })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.isActive, true))
      .orderBy(desc(newsletterSubscribers.createdAt))

    const csv = Papa.unparse({
      fields: ['email', 'zgoda_z_dnia', 'potwierdzenie_z_dnia', 'zapis_z_dnia'],
      data: rows.map((row) => [
        row.email,
        row.consentAt?.toISOString() ?? '',
        row.confirmedAt ? new Date(row.confirmedAt).toISOString() : '',
        row.createdAt?.toISOString() ?? '',
      ]),
    })
    const day = new Date().toISOString().slice(0, 10)
    return { csv, count: rows.length, fileName: `newsletter_${day}.csv` }
  }, 'Nie udało się wyeksportować subskrybentów.')
}

/** Ręczne wypisanie (np. na prośbę mailową) — historia zgody zostaje. */
export async function adminSetSubscriberActive(id: string, active: boolean): Promise<ActionResult> {
  return runAdminAction(async () => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Nieprawidłowy identyfikator.')
    if (active) {
      // Przywrócić można tylko adres, który kiedyś POTWIERDZIŁ zapis
      // (double opt-in) — niepotwierdzonego nie wolno zapisać ręcznie.
      const [row] = await db
        .select({ confirmedAt: newsletterSubscribers.confirmedAt })
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.id, id))
        .limit(1)
      if (!row?.confirmedAt) throw new Error('Ten adres nie potwierdził zapisu — nie można go aktywować ręcznie.')
    }
    await db.update(newsletterSubscribers).set({ isActive: active }).where(eq(newsletterSubscribers.id, id))
    revalidatePath('/admin/marketing')
    return null
  }, 'Nie udało się zmienić subskrypcji.')
}
