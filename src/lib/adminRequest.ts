/*
 * Długie operacje panelu z przeglądarki (import CSV partiami, zdjęcia z ZIP-a).
 *
 * Dwa problemy, które przerywały import w połowie:
 * 1. Sesja Clerka to krótki token (~60 s) w ciasteczku `__session`, odświeżany
 *    przez clerk-js w tle. Przeglądarka usypia liczniki w karcie w tle, więc po
 *    kilku minutach importu ciasteczko było przeterminowane → 401 „Unauthorized”
 *    (wyglądało jak wylogowanie). Przed KAŻDYM żądaniem bierzemy świeży token
 *    (`session.getToken()` odświeża też ciasteczko) i wysyłamy go nagłówkiem.
 * 2. Jedno zerwane połączenie / 502 / 504 z hostingu kończyło cały import.
 *    Żądania są ponawiane z przerwą; import wiersza jest idempotentny (produkt
 *    rozpoznaje SKU, także szkic z nieudanej próby), więc ponowienie jest bezpieczne.
 */

type ClerkSessionLike = { getToken: (options?: { skipCache?: boolean }) => Promise<string | null> }
type ClerkLike = { session?: ClerkSessionLike | null; loaded?: boolean }

declare global {
  interface Window {
    Clerk?: ClerkLike
  }
}

export class AdminRequestError extends Error {
  constructor(
    message: string,
    /** HTTP status albo 0 (brak połączenia / limit czasu). */
    readonly status: number,
    /** Czy ponowienie (np. z mniejszą partią) ma sens. */
    readonly retryable: boolean,
    /** Sesja wygasła naprawdę — trzeba się zalogować ponownie. */
    readonly sessionExpired = false
  ) {
    super(message)
    this.name = 'AdminRequestError'
  }
}

/** Świeży token sesji (null = brak sesji albo clerk-js niedostępny). */
export async function freshSessionToken(force = false): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const session = window.Clerk?.session
  if (!session) return null
  try {
    return await session.getToken(force ? { skipCache: true } : undefined)
  } catch {
    return null
  }
}

/** Odświeża ciasteczko sesji przed server action (akcje nie przyjmują nagłówka). */
export async function keepSessionAlive(): Promise<void> {
  await freshSessionToken()
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524])
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export type AdminPostOptions = {
  /** Limit jednej próby (ms). */
  timeoutMs?: number
  /** Łączna liczba prób. */
  attempts?: number
  /** Wywoływane przed ponowieniem (np. do komunikatu w pasku postępu). */
  onRetry?: (attempt: number, attempts: number, reason: string) => void
}

/**
 * POST formularza do trasy API panelu z odświeżaniem sesji, limitem czasu
 * i ponowieniami. Zwraca JSON odpowiedzi albo rzuca `AdminRequestError`.
 */
export async function postAdminForm<T>(url: string, form: FormData, options: AdminPostOptions = {}): Promise<T> {
  const { timeoutMs = 120_000, attempts = 4, onRetry } = options
  let refreshToken = false
  let last: AdminRequestError | null = null

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1) {
      onRetry?.(attempt, attempts, last?.message ?? '')
      await wait(Math.min(15_000, 1_500 * 2 ** (attempt - 2)))
    }
    const token = await freshSessionToken(refreshToken)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: form,
        signal: controller.signal,
        credentials: 'same-origin',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null
      if (res.ok && json) return json
      if (res.ok) {
        // 200 bez JSON-a = strona HTML (np. przekierowanie do logowania albo błąd proxy).
        last = new AdminRequestError('Serwer zwrócił nieoczekiwaną odpowiedź (nie JSON).', res.status, true)
        continue
      }
      if (res.status === 401) {
        const stillSignedIn = Boolean(await freshSessionToken(true))
        if (!stillSignedIn) {
          throw new AdminRequestError('Sesja wygasła — zaloguj się ponownie (w nowej karcie) i kliknij „Wznów import”.', 401, true, true)
        }
        refreshToken = true
        last = new AdminRequestError('Sesja wymagała odświeżenia.', 401, true)
        continue
      }
      const message = json?.error ?? `Serwer odpowiedział błędem ${res.status}${res.statusText ? ` (${res.statusText})` : ''}.`
      last = new AdminRequestError(message, res.status, RETRYABLE_STATUS.has(res.status))
      if (!last.retryable) throw last
    } catch (err) {
      if (err instanceof AdminRequestError) throw err
      last = controller.signal.aborted
        ? new AdminRequestError(`Serwer nie odpowiedział w ciągu ${Math.round(timeoutMs / 1000)} s.`, 0, true)
        : new AdminRequestError('Brak połączenia z serwerem.', 0, true)
    } finally {
      clearTimeout(timer)
    }
  }
  throw last ?? new AdminRequestError('Żądanie nie powiodło się.', 0, true)
}
