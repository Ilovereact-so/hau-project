'use server'

import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { auth, currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { productReviews } from '@/db/schema'
import {
  consumeReviewWriteQuota,
  getReviewSummary,
  getUserReview,
  hasPurchasedProduct,
  invalidateReviewSummary,
  productExists,
} from '@/lib/reviews'
import {
  buildAuthorName,
  isValidProductId,
  validateReviewInput,
  type MyReview,
  type ReviewFieldErrors,
  type ReviewInput,
  type ReviewSummaryFull,
} from '@/lib/reviewsShared'

/*
 * Akcje klienta. Zwracają wynik zamiast rzucać — Next na produkcji ukrywa
 * treść wyjątków, a formularz musi pokazać konkretny komunikat.
 */

export type ReviewActionResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fieldErrors?: ReviewFieldErrors; needsLogin?: boolean }

const LOGIN_REQUIRED = { ok: false as const, error: 'Zaloguj się, aby wystawić opinię.', needsLogin: true }

function isDuplicateKey(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null
  return e?.code === 'ER_DUP_ENTRY' || e?.cause?.code === 'ER_DUP_ENTRY'
}

/** Dodaje opinię albo aktualizuje istniejącą (jedna na konto i produkt). */
export async function submitReview(
  input: ReviewInput,
): Promise<ReviewActionResult<{ review: MyReview; summary: ReviewSummaryFull; created: boolean }>> {
  const { userId } = await auth()
  if (!userId) return LOGIN_REQUIRED

  const parsed = validateReviewInput(input)
  if (!parsed.ok) {
    return { ok: false, error: 'Popraw zaznaczone pola.', fieldErrors: parsed.errors }
  }
  const { productId, rating, title, body } = parsed.data

  try {
    if (!(await consumeReviewWriteQuota(userId))) {
      return { ok: false, error: 'Zbyt wiele zmian w krótkim czasie. Spróbuj ponownie za kilka minut.' }
    }
    if (!(await productExists(productId))) {
      return { ok: false, error: 'Ten produkt nie jest już dostępny w sklepie.' }
    }

    const [user, verifiedPurchase] = await Promise.all([
      currentUser(),
      hasPurchasedProduct(userId, productId),
    ])
    const authorName = buildAuthorName(user?.firstName, user?.lastName)

    const whereMine = and(eq(productReviews.userId, userId), eq(productReviews.productId, productId))
    const [existing] = await db.select({ id: productReviews.id }).from(productReviews).where(whereMine).limit(1)

    let created = false
    if (existing) {
      // Status (ukrycie przez moderatora) i odpowiedź sklepu zostają bez zmian.
      await db
        .update(productReviews)
        .set({ rating, title, body, authorName, verifiedPurchase })
        .where(eq(productReviews.id, existing.id))
    } else {
      try {
        await db.insert(productReviews).values({
          id: randomUUID(),
          productId,
          userId,
          authorName,
          rating,
          title,
          body,
          verifiedPurchase,
        })
        created = true
      } catch (error) {
        // Dwa równoległe wysłania formularza — drugie staje się edycją.
        if (!isDuplicateKey(error)) throw error
        await db
          .update(productReviews)
          .set({ rating, title, body, authorName, verifiedPurchase })
          .where(whereMine)
      }
    }

    await invalidateReviewSummary(productId)
    const [review, summary] = await Promise.all([
      getUserReview(userId, productId),
      getReviewSummary(productId),
    ])
    if (!review) throw new Error('Opinia nie została zapisana.')
    return { ok: true, review, summary, created }
  } catch (error) {
    console.error('[reviews] submit failed', error)
    return { ok: false, error: 'Nie udało się zapisać opinii. Spróbuj ponownie.' }
  }
}

/** Usuwa opinię zalogowanego klienta o danym produkcie. */
export async function deleteMyReview(
  productId: string,
): Promise<ReviewActionResult<{ summary: ReviewSummaryFull }>> {
  const { userId } = await auth()
  if (!userId) return LOGIN_REQUIRED
  if (!isValidProductId(productId)) return { ok: false, error: 'Nieprawidłowy produkt.' }

  try {
    if (!(await consumeReviewWriteQuota(userId))) {
      return { ok: false, error: 'Zbyt wiele zmian w krótkim czasie. Spróbuj ponownie za kilka minut.' }
    }
    await db
      .delete(productReviews)
      .where(and(eq(productReviews.userId, userId), eq(productReviews.productId, productId)))
    await invalidateReviewSummary(productId)
    return { ok: true, summary: await getReviewSummary(productId) }
  } catch (error) {
    console.error('[reviews] delete failed', error)
    return { ok: false, error: 'Nie udało się usunąć opinii. Spróbuj ponownie.' }
  }
}
