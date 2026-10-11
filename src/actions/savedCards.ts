'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { savedCards } from '@/db/schema'
import { AUTOPAY_RECURRING_ENABLED } from '@/lib/autopay'
import { listActiveCards } from '@/lib/savedCards.server'
import type { SavedCardView } from '@/lib/savedCardsShared'

/** @deprecated nazwa zgodności — używaj `SavedCardView` z `lib/savedCardsShared`. */
export type SavedCard = SavedCardView

/**
 * Karty zapisane przez klienta (profil → Płatności).
 *
 * Trzymamy wyłącznie token płatności automatycznej z Autopay oraz dane do
 * wyświetlenia (wydawca, 4 ostatnie cyfry, data ważności). Pełny numer karty
 * i CVV nigdy nie trafiają na nasz serwer, a token nie wychodzi do przeglądarki.
 */
export async function getMySavedCards(): Promise<SavedCardView[]> {
  const { userId } = await auth()
  if (!userId) return []
  return listActiveCards(userId)
}

/**
 * Karty do wyboru w kasie — pusta lista, gdy płatności zapisaną kartą są
 * wyłączone (`AUTOPAY_RECURRING_ENABLED`), żeby kasa nie proponowała metody,
 * której bramka nie przyjmie.
 */
export async function getCheckoutSavedCards(): Promise<SavedCardView[]> {
  if (!AUTOPAY_RECURRING_ENABLED) return []
  return getMySavedCards()
}

export type RemoveCardResult = { ok: true } | { ok: false; error: string }

/**
 * Usuwa kartę z konta — od razu znika z profilu i z wyboru w kasie, a token
 * przestaje być używany. Autopay usuwa dane karty po swojej stronie zgodnie
 * z regulaminem płatności automatycznych; gdy karta zostanie usunięta tam
 * (np. przez bank), dostajemy `recurringDeactivation` i dezaktywujemy ją tu.
 */
export async function removeSavedCard(cardId: string): Promise<RemoveCardResult> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: 'Musisz być zalogowany' }
  if (typeof cardId !== 'string' || !cardId) return { ok: false, error: 'Nie znaleziono karty' }

  const [card] = await db
    .select({ id: savedCards.id })
    .from(savedCards)
    .where(and(eq(savedCards.id, cardId), eq(savedCards.userId, userId), eq(savedCards.isActive, true)))

  if (!card) return { ok: false, error: 'Nie znaleziono karty' }

  await db
    .update(savedCards)
    .set({ isActive: false })
    .where(and(eq(savedCards.id, cardId), eq(savedCards.userId, userId)))

  revalidatePath('/profile/payment')
  return { ok: true }
}
