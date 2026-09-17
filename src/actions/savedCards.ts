'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { savedCards } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'

export interface SavedCard {
  id:           string
  maskedNumber: string | null
  expiryMonth:  number | null
  expiryYear:   number | null
  cardBrand:    string | null
  createdAt:    Date | null
}

/**
 * Karty zapisane przez klienta.
 *
 * Trzymamy wyłącznie token płatności automatycznej z Autopay oraz dane do
 * wyświetlenia (maska, data ważności, wydawca). Pełny numer karty i CVV nigdy
 * nie trafiają na nasz serwer.
 */
export async function getMySavedCards(): Promise<SavedCard[]> {
  const { userId } = await auth()
  if (!userId) return []

  return db
    .select({
      id:           savedCards.id,
      maskedNumber: savedCards.maskedNumber,
      expiryMonth:  savedCards.expiryMonth,
      expiryYear:   savedCards.expiryYear,
      cardBrand:    savedCards.cardBrand,
      createdAt:    savedCards.createdAt,
    })
    .from(savedCards)
    .where(and(eq(savedCards.userId, userId), eq(savedCards.isActive, true)))
    .orderBy(desc(savedCards.createdAt))
}

export type RemoveCardResult = { ok: true } | { ok: false; error: string }

/**
 * Usuwa kartę z konta.
 *
 * Token dezaktywujemy u siebie. Wycofanie zgody po stronie Autopay
 * (`RecurringAction: DEACTIVATE`) wymaga włączonej usługi płatności
 * automatycznych — do dopięcia, gdy Autopay ją aktywuje.
 */
export async function removeSavedCard(cardId: string): Promise<RemoveCardResult> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: 'Musisz być zalogowany' }

  const [card] = await db
    .select({ id: savedCards.id })
    .from(savedCards)
    .where(and(eq(savedCards.id, cardId), eq(savedCards.userId, userId)))

  if (!card) return { ok: false, error: 'Nie znaleziono karty' }

  await db
    .update(savedCards)
    .set({ isActive: false })
    .where(eq(savedCards.id, cardId))

  revalidatePath('/profile/payment')
  return { ok: true }
}
