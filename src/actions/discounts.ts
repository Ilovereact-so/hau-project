'use server'

import { auth } from '@clerk/nextjs/server'
import { headers } from 'next/headers'
import { readGuestId } from '@/lib/cartServer'
import { cartSubtotalCents } from '@/lib/cartPricing'
import {
  DiscountError,
  assertNotRateLimited,
  lookupDiscount,
  recordFailedAttempt,
} from '@/lib/discountServer'
import { discountBenefitLabel, type DiscountType } from '@/lib/discounts'

export interface DiscountPreviewItem {
  productId: string
  variantId: string
  qty:       number
}

/**
 * Podgląd kodu dla koszyka/kasy. `applicable: false` = kod istnieje, ale
 * warunek nie jest spełniony (np. próg wartości) — koszyk go trzyma
 * i podpowiada, czego brakuje. `ok: false` = kodu nie da się użyć wcale.
 */
export type DiscountPreview =
  | {
      ok: true
      code: string
      type: DiscountType
      benefit: string
      description: string | null
      subtotalCents: number
      applicable: boolean
      productDiscountCents: number
      freeShipping: boolean
      message?: string
    }
  | { ok: false; error: string }

async function attemptSubject(): Promise<string> {
  const { userId } = await auth()
  if (userId) return `u:${userId}`
  const guestId = await readGuestId()
  if (guestId) return `g:${guestId}`
  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown'
  return `ip:${ip}`
}

export async function previewDiscountCode(input: {
  code: string
  items: DiscountPreviewItem[]
}): Promise<DiscountPreview> {
  try {
    const items = Array.isArray(input.items) ? input.items.slice(0, 100) : []
    const subject = await attemptSubject()
    await assertNotRateLimited(subject)

    const { userId } = await auth()
    const subtotalCents = await cartSubtotalCents(
      items.map(i => ({ productId: String(i.productId), variantId: String(i.variantId ?? ''), qty: Number(i.qty) || 0 })),
    )

    const result = await lookupDiscount(String(input.code ?? '').slice(0, 64), {
      subtotalCents,
      customer: userId ? { key: userId, email: null } : null,
    })

    if (!result.ok) {
      if (result.notFound) await recordFailedAttempt(subject)
      return { ok: false, error: result.message }
    }

    const { rule, evaluation } = result
    const base = {
      ok: true as const,
      code: rule.code,
      type: rule.type,
      benefit: discountBenefitLabel(rule),
      description: rule.description,
      subtotalCents,
    }
    if (evaluation.ok) {
      return {
        ...base,
        applicable: true,
        productDiscountCents: evaluation.productDiscountCents,
        freeShipping: evaluation.freeShipping,
      }
    }
    // Próg wartości da się spełnić dokładając produkty — kod zostaje w koszyku.
    if (evaluation.reason === 'min_subtotal') {
      return { ...base, applicable: false, productDiscountCents: 0, freeShipping: false, message: evaluation.message }
    }
    return { ok: false, error: evaluation.message }
  } catch (err) {
    if (err instanceof DiscountError) return { ok: false, error: err.message }
    console.error('[discounts] podgląd kodu:', err)
    return { ok: false, error: 'Nie udało się sprawdzić kodu. Spróbuj ponownie.' }
  }
}
