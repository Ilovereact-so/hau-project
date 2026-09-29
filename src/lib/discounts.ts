/*
 * Kody rabatowe — czysta logika (bez importów serwerowych).
 *
 * Źródłem prawdy jest SERWER: koszyk pokazuje podgląd liczony przez server
 * action na cenach z Sanity, a kasa liczy rabat jeszcze raz w transakcji
 * zamówienia. Ten moduł trzyma reguły, żeby oba miejsca liczyły identycznie.
 *
 * Zasady (jak w dużych sklepach):
 * - rabat procentowy i kwotowy liczony od WARTOŚCI PRODUKTÓW (bez dostawy),
 *   procent zaokrąglany w dół do grosza, opcjonalnie z górną granicą;
 * - „darmowa dostawa” zeruje koszt wybranej dostawy;
 * - jeden kod na zamówienie;
 * - do zapłaty zostaje co najmniej MIN_PAYABLE_CENTS (bramki płatności nie
 *   przyjmują zerowych transakcji).
 */

export type DiscountType = 'percent' | 'fixed' | 'free_shipping'

export interface DiscountRule {
  code:              string
  description:       string | null
  type:              DiscountType
  /** procent (1–100) albo grosze (fixed) */
  value:             number
  minSubtotalCents:  number
  maxDiscountCents:  number | null
  startsAt:          Date | null
  endsAt:            Date | null
  usageLimit:        number | null
  usageLimitPerUser: number | null
  timesUsed:         number
  isActive:          boolean
}

export const MIN_PAYABLE_CENTS = 100
export const DISCOUNT_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,31}$/

export type DiscountRejection =
  | 'invalid_format'
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'usage_limit'
  | 'user_limit'
  | 'min_subtotal'

export type DiscountEvaluation =
  | {
      ok: true
      /** rabat od produktów (bez dostawy) */
      productDiscountCents: number
      freeShipping: boolean
    }
  | { ok: false; reason: DiscountRejection; message: string; missingCents?: number }

/** Wielkie litery, bez spacji — klient może wpisać „newsletter10 ”. */
export function normalizeDiscountCode(input: string): string {
  return String(input ?? '').replace(/\s+/g, '').toUpperCase()
}

export function formatPLN(cents: number): string {
  return `${(cents / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
}

/** Krótki opis korzyści: „−10%”, „−20,00 zł”, „Darmowa dostawa”. */
export function discountBenefitLabel(rule: Pick<DiscountRule, 'type' | 'value'>): string {
  if (rule.type === 'percent') return `−${rule.value}%`
  if (rule.type === 'fixed') return `−${formatPLN(rule.value)}`
  return 'Darmowa dostawa'
}

export const REJECTION_MESSAGES: Record<Exclude<DiscountRejection, 'min_subtotal'>, string> = {
  invalid_format: 'Nieprawidłowy kod rabatowy.',
  not_found: 'Nie znaleźliśmy takiego kodu. Sprawdź pisownię.',
  inactive: 'Ten kod nie jest już aktywny.',
  not_started: 'Ten kod nie jest jeszcze aktywny.',
  expired: 'Ten kod wygasł.',
  usage_limit: 'Limit użyć tego kodu został wyczerpany.',
  user_limit: 'Ten kod został już przez Ciebie wykorzystany.',
}

/**
 * Czy kod można zastosować i ile daje. `customerUses` — ile razy klient już
 * go użył (`null`, gdy nie wiadomo — np. podgląd dla gościa; wtedy limit na
 * klienta sprawdza dopiero kasa).
 */
export function evaluateDiscount(
  rule: DiscountRule,
  ctx: { subtotalCents: number; now?: Date; customerUses?: number | null },
): DiscountEvaluation {
  const now = ctx.now ?? new Date()
  const reject = (reason: Exclude<DiscountRejection, 'min_subtotal'>): DiscountEvaluation => ({
    ok: false,
    reason,
    message: REJECTION_MESSAGES[reason],
  })

  if (!rule.isActive) return reject('inactive')
  if (rule.startsAt && now < rule.startsAt) return reject('not_started')
  if (rule.endsAt && now >= rule.endsAt) return reject('expired')
  if (rule.usageLimit !== null && rule.timesUsed >= rule.usageLimit) return reject('usage_limit')
  if (rule.usageLimitPerUser !== null && ctx.customerUses != null && ctx.customerUses >= rule.usageLimitPerUser) {
    return reject('user_limit')
  }

  if (rule.minSubtotalCents > 0 && ctx.subtotalCents < rule.minSubtotalCents) {
    const missingCents = rule.minSubtotalCents - ctx.subtotalCents
    return {
      ok: false,
      reason: 'min_subtotal',
      missingCents,
      message: `Kod działa od ${formatPLN(rule.minSubtotalCents)} — dodaj produkty za ${formatPLN(missingCents)}.`,
    }
  }

  if (rule.type === 'free_shipping') return { ok: true, productDiscountCents: 0, freeShipping: true }

  let cents =
    rule.type === 'percent'
      ? Math.floor((ctx.subtotalCents * Math.min(Math.max(rule.value, 0), 100)) / 100)
      : Math.max(rule.value, 0)
  if (rule.type === 'percent' && rule.maxDiscountCents !== null) cents = Math.min(cents, rule.maxDiscountCents)
  cents = Math.min(cents, ctx.subtotalCents)
  return { ok: true, productDiscountCents: cents, freeShipping: false }
}

/**
 * Łączny rabat i kwota do zapłaty. `shippingCents` = `null`, gdy dostawa nie
 * jest jeszcze wybrana (koszyk) — wtedy darmowa dostawa nie ma kwoty.
 */
export function applyDiscount(
  evaluation: DiscountEvaluation | null,
  subtotalCents: number,
  shippingCents: number | null,
): { discountCents: number; totalCents: number } {
  const shipping = shippingCents ?? 0
  const gross = subtotalCents + shipping
  if (!evaluation?.ok) return { discountCents: 0, totalCents: gross }
  let discount = evaluation.productDiscountCents + (evaluation.freeShipping ? shipping : 0)
  // Zostaw minimum do zapłaty — bramki nie przyjmują transakcji na 0 zł.
  discount = Math.max(0, Math.min(discount, gross - MIN_PAYABLE_CENTS))
  return { discountCents: discount, totalCents: gross - discount }
}

/** Status kodu do panelu (niezależny od koszyka). */
export function discountStatus(
  rule: Pick<DiscountRule, 'isActive' | 'startsAt' | 'endsAt' | 'usageLimit' | 'timesUsed'>,
  now = new Date(),
): 'active' | 'scheduled' | 'expired' | 'exhausted' | 'disabled' {
  if (!rule.isActive) return 'disabled'
  if (rule.endsAt && now >= rule.endsAt) return 'expired'
  if (rule.usageLimit !== null && rule.timesUsed >= rule.usageLimit) return 'exhausted'
  if (rule.startsAt && now < rule.startsAt) return 'scheduled'
  return 'active'
}
