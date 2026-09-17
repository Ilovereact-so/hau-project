import 'server-only'
import { auth } from '@clerk/nextjs/server'

/**
 * Jedno miejsce sprawdzania roli admina dla akcji i tras panelu.
 * Middleware chroni `/admin(.*)`, ale server action da się wywołać
 * z dowolnej strony — dlatego KAŻDA akcja panelu woła to na starcie.
 */
export async function requireAdmin(): Promise<{ userId: string }> {
  const { userId, sessionClaims } = await auth()
  if (!userId) throw new Error('Brak uprawnień — zaloguj się.')
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  if (role !== 'admin') throw new Error('Brak uprawnień — wymagana rola admin.')
  return { userId }
}

/** Wariant dla tras API: zwraca `null`, gdy dostęp jest dozwolony. */
export async function adminDenied(): Promise<{ status: 401 | 403; error: string } | null> {
  const { userId, sessionClaims } = await auth()
  if (!userId) return { status: 401, error: 'Unauthorized' }
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  if (role !== 'admin') return { status: 403, error: 'Forbidden' }
  return null
}

/** Czytelny komunikat z dowolnego wyjątku (do toastów i ErrorBox). */
export function errorMessage(error: unknown, fallback = 'Operacja nie powiodła się.'): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return fallback
}

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string }

/** Owija akcję tak, żeby błąd wracał jako wartość, a nie wyjątek (Next ukrywa treść wyjątków na produkcji). */
export async function runAdminAction<T>(fn: () => Promise<T>, fallback?: string): Promise<ActionResult<T>> {
  try {
    await requireAdmin()
    return { ok: true, data: await fn() }
  } catch (error) {
    console.error('[admin action]', error)
    return { ok: false, error: errorMessage(error, fallback) }
  }
}
