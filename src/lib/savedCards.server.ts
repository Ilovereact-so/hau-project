import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { savedCards } from '@/db/schema'
import type { SavedCardView } from '@/lib/savedCardsShared'

/*
 * Zapisane karty — warstwa danych (server-only).
 *
 * Tabela `saved_cards` trzyma token Autopay (`ClientHash`) i dane do
 * wyświetlenia. Token NIGDY nie trafia do przeglądarki: kasa wysyła tylko
 * `id` karty, a serwer sam szuka tokenu — i tylko wśród kart zalogowanego
 * właściciela.
 */

export const isGuestOwner = (ownerId: string | null | undefined) => !ownerId || ownerId.startsWith('guest_')

export async function listActiveCards(userId: string): Promise<SavedCardView[]> {
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

/** Token karty — tylko aktywnej i tylko jeśli należy do tego użytkownika. */
export async function findCardTokenForUser(userId: string, cardId: string): Promise<string | null> {
  if (!cardId || isGuestOwner(userId)) return null
  const [card] = await db
    .select({ token: savedCards.token })
    .from(savedCards)
    .where(and(eq(savedCards.id, cardId), eq(savedCards.userId, userId), eq(savedCards.isActive, true)))
    .limit(1)
  return card?.token ?? null
}

export interface SavedCardInput {
  userId:      string
  token:       string
  mask:        string | null
  brand:       string | null
  expiryMonth: number | null
  expiryYear:  number | null
}

/**
 * Zapis karty bez duplikatów. Ta sama karta zapisana drugi raz (nowa płatność
 * z zaznaczonym „zapamiętaj”) nie tworzy kolejnego wiersza:
 *  1. ten sam token u tego klienta → aktualizacja danych i reaktywacja,
 *  2. ta sama karta (wydawca + 4 cyfry + ważność) → nowy token w istniejącym wierszu,
 *  3. inaczej nowy wiersz.
 * Idempotentne — Autopay może ponowić powiadomienie.
 */
export async function upsertSavedCard(input: SavedCardInput): Promise<void> {
  const values = {
    token:        input.token,
    maskedNumber: input.mask,
    cardBrand:    input.brand,
    expiryMonth:  input.expiryMonth,
    expiryYear:   input.expiryYear,
    isActive:     true,
  }

  const userCards = await db
    .select({
      id:           savedCards.id,
      token:        savedCards.token,
      maskedNumber: savedCards.maskedNumber,
      cardBrand:    savedCards.cardBrand,
      expiryMonth:  savedCards.expiryMonth,
      expiryYear:   savedCards.expiryYear,
    })
    .from(savedCards)
    .where(eq(savedCards.userId, input.userId))

  const last4 = (value: string | null) => (value ?? '').replace(/\D/g, '').slice(-4)
  const sameToken = userCards.find((card) => card.token === input.token)
  const samePhysicalCard = userCards.find(
    (card) =>
      last4(card.maskedNumber) !== '' &&
      last4(card.maskedNumber) === last4(input.mask) &&
      (card.cardBrand ?? '').toUpperCase() === (input.brand ?? '').toUpperCase() &&
      card.expiryMonth === input.expiryMonth &&
      card.expiryYear === input.expiryYear,
  )
  const existing = sameToken ?? samePhysicalCard

  if (existing) {
    await db.update(savedCards).set(values).where(eq(savedCards.id, existing.id))
    return
  }

  await db.insert(savedCards).values({
    id:       crypto.randomUUID(),
    userId:   input.userId,
    provider: 'autopay',
    ...values,
  })
}

/** Karta usunięta po stronie Autopay / banku (`recurringDeactivation`). */
export async function deactivateCardByToken(token: string): Promise<number> {
  const result = await db.update(savedCards).set({ isActive: false }).where(eq(savedCards.token, token))
  const header = Array.isArray(result) ? result[0] : result
  return (header as { affectedRows?: number })?.affectedRows ?? 0
}
