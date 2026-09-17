/*
 * Opinie o produktach — typy, stałe i walidacja wspólne dla serwera i klienta.
 * Bez importów serwerowych: plik trafia też do bundla przeglądarki
 * (formularz waliduje dane tymi samymi regułami co akcja serwerowa).
 */

export const REVIEW_RATING_MIN = 1
export const REVIEW_RATING_MAX = 5
export const REVIEW_TITLE_MAX = 120
export const REVIEW_BODY_MIN = 10
export const REVIEW_BODY_MAX = 2000
export const REVIEW_REPLY_MAX = 2000
/** Ile opinii ładuje jedna porcja listy na stronie produktu. */
export const REVIEWS_PAGE_SIZE = 5
/** Limit identyfikatorów w jednym zapytaniu zbiorczym o podsumowania. */
export const REVIEW_SUMMARY_BATCH_MAX = 60

export const REVIEW_SORTS = ['newest', 'highest', 'lowest'] as const
export type ReviewSort = typeof REVIEW_SORTS[number]

export const REVIEW_SORT_LABELS: Record<ReviewSort, string> = {
  newest: 'Najnowsze',
  highest: 'Najwyżej oceniane',
  lowest: 'Najniżej oceniane',
}

/** Średnia i liczba opublikowanych opinii produktu. */
export type ReviewSummary = {
  average: number
  count: number
}

/** Podsumowanie z rozkładem ocen: `distribution[0]` = liczba ocen 1, …, `[4]` = ocen 5. */
export type ReviewSummaryFull = ReviewSummary & {
  distribution: [number, number, number, number, number]
}

export const EMPTY_SUMMARY: ReviewSummaryFull = { average: 0, count: 0, distribution: [0, 0, 0, 0, 0] }

/** Opinia w postaci publicznej — bez identyfikatora konta autora. */
export type PublicReview = {
  id: string
  rating: number
  title: string | null
  body: string
  authorName: string
  verifiedPurchase: boolean
  adminReply: string | null
  adminReplyAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

/** Opinia zalogowanego klienta (formularz edycji). */
export type MyReview = PublicReview & { status: 'published' | 'hidden' }

export type ReviewPage = {
  reviews: PublicReview[]
  /** Liczba opinii pasujących do filtra (do przycisku „Pokaż więcej”). */
  total: number
  hasMore: boolean
}

export type ReviewInput = {
  productId: string
  rating: number
  title?: string | null
  body: string
}

export type ReviewFieldErrors = Partial<Record<'rating' | 'title' | 'body' | 'productId', string>>

/** Identyfikator dokumentu Sanity: litery, cyfry, `-`, `_`, `.` — bez szkiców. */
export function isValidProductId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9._-]+$/.test(value) &&
    !value.startsWith('drafts.')
  )
}

export function isReviewSort(value: unknown): value is ReviewSort {
  return typeof value === 'string' && (REVIEW_SORTS as readonly string[]).includes(value)
}

/** Ocena 1–5 albo `null`, gdy wartość nie jest poprawną oceną. */
export function parseRating(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value
  if (typeof n !== 'number' || !Number.isInteger(n)) return null
  return n >= REVIEW_RATING_MIN && n <= REVIEW_RATING_MAX ? n : null
}

/**
 * Normalizacja tekstu z formularza: ujednolicone końce linii, bez znaków
 * sterujących (poza nową linią i tabulatorem), maks. dwie puste linie z rzędu.
 * Treść renderujemy jako tekst (React escapuje HTML), więc to porządki, a nie
 * ochrona przed XSS.
 */
export function cleanReviewText(value: unknown, { multiline }: { multiline: boolean }): string {
  if (typeof value !== 'string') return ''
  let text = value.replace(/\r\n?/g, '\n')
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  if (multiline) {
    text = text
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/g, ''))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
  } else {
    text = text.replace(/\s+/g, ' ')
  }
  return text.trim()
}

/** Walidacja danych opinii. Zwraca oczyszczone dane albo błędy per pole. */
export function validateReviewInput(input: Partial<ReviewInput> | null | undefined):
  | { ok: true; data: { productId: string; rating: number; title: string | null; body: string } }
  | { ok: false; errors: ReviewFieldErrors } {
  const errors: ReviewFieldErrors = {}
  const productId = input?.productId
  if (!isValidProductId(productId)) errors.productId = 'Nieprawidłowy produkt.'

  const rating = parseRating(input?.rating)
  if (rating === null) errors.rating = 'Wybierz ocenę od 1 do 5 łapek.'

  const title = cleanReviewText(input?.title, { multiline: false })
  if (title.length > REVIEW_TITLE_MAX) errors.title = `Tytuł może mieć maksymalnie ${REVIEW_TITLE_MAX} znaków.`

  const body = cleanReviewText(input?.body, { multiline: true })
  if (body.length < REVIEW_BODY_MIN) errors.body = `Opinia musi mieć co najmniej ${REVIEW_BODY_MIN} znaków.`
  else if (body.length > REVIEW_BODY_MAX) errors.body = `Opinia może mieć maksymalnie ${REVIEW_BODY_MAX} znaków.`

  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, data: { productId: productId as string, rating: rating as number, title: title || null, body } }
}

/** Średnia z rozkładu ocen, zaokrąglona do jednego miejsca po przecinku. */
export function summaryFromDistribution(distribution: ReviewSummaryFull['distribution']): ReviewSummaryFull {
  const count = distribution.reduce((sum, n) => sum + n, 0)
  const total = distribution.reduce((sum, n, i) => sum + n * (i + 1), 0)
  const average = count ? Math.round((total / count) * 10) / 10 : 0
  return { average, count, distribution }
}

const averageFormat = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** 4.8 → „4,8” */
export function formatAverage(value: number): string {
  return averageFormat.format(Number.isFinite(value) ? value : 0)
}

/** Polska forma liczby mnogiej: 1 opinia, 2 opinie, 5 opinii, 22 opinie. */
export function reviewsLabel(count: number): string {
  const n = Math.abs(Math.trunc(count))
  if (n === 1) return 'opinia'
  const lastDigit = n % 10
  const lastTwo = n % 100
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'opinie'
  return 'opinii'
}

const dateFormat = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })

/** ISO → „16 września 2026” */
export function formatReviewDate(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date)
}

/** Podpis autora z danych konta: „Anna K.”; bez imienia — „Klient HAU”. */
export function buildAuthorName(firstName?: string | null, lastName?: string | null): string {
  const first = cleanReviewText(firstName, { multiline: false }).slice(0, 40)
  const last = cleanReviewText(lastName, { multiline: false })
  if (!first) return 'Klient HAU'
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first
}
