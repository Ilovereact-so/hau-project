'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { productReviews, REVIEW_STATUSES, type ReviewStatus } from '@/db/schema'
import { runAdminAction, type ActionResult } from '@/lib/admin/guard'
import { invalidateReviewSummary } from '@/lib/reviews'
import { REVIEW_REPLY_MAX, cleanReviewText } from '@/lib/reviewsShared'

const UUID_RE = /^[0-9a-f-]{36}$/i

async function findReview(id: string) {
  if (!UUID_RE.test(id)) throw new Error('Nieprawidłowy identyfikator opinii.')
  const [row] = await db
    .select({ id: productReviews.id, productId: productReviews.productId })
    .from(productReviews)
    .where(eq(productReviews.id, id))
    .limit(1)
  if (!row) throw new Error('Opinia nie istnieje — mogła zostać usunięta przez autora.')
  return row
}

/** Publikacja / ukrycie opinii. Ukryta nie liczy się do średniej produktu. */
export async function adminSetReviewStatus(id: string, status: ReviewStatus): Promise<ActionResult> {
  return runAdminAction(async () => {
    if (!(REVIEW_STATUSES as readonly string[]).includes(status)) throw new Error('Nieprawidłowy status.')
    const review = await findReview(id)
    await db.update(productReviews).set({ status }).where(eq(productReviews.id, id))
    await invalidateReviewSummary(review.productId)
    revalidatePath('/admin/reviews')
    return null
  }, 'Nie udało się zmienić statusu opinii.')
}

/** Odpowiedź sklepu pod opinią. Pusty tekst usuwa odpowiedź. */
export async function adminReplyToReview(id: string, reply: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    const review = await findReview(id)
    const text = cleanReviewText(reply, { multiline: true })
    if (text.length > REVIEW_REPLY_MAX) {
      throw new Error(`Odpowiedź może mieć maksymalnie ${REVIEW_REPLY_MAX} znaków.`)
    }
    await db
      .update(productReviews)
      .set({ adminReply: text || null, adminReplyAt: text ? new Date() : null })
      .where(eq(productReviews.id, review.id))
    revalidatePath('/admin/reviews')
    return null
  }, 'Nie udało się zapisać odpowiedzi.')
}

/** Trwałe usunięcie opinii (np. spam, dane osobowe w treści). */
export async function adminDeleteReview(id: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    const review = await findReview(id)
    await db.delete(productReviews).where(eq(productReviews.id, review.id))
    await invalidateReviewSummary(review.productId)
    revalidatePath('/admin/reviews')
    return null
  }, 'Nie udało się usunąć opinii.')
}
