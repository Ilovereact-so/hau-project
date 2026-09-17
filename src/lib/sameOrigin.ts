import 'server-only'
import type { NextRequest } from 'next/server'

/**
 * Prosta ochrona CSRF dla tras mutujących wywoływanych z przeglądarki
 * (fetch keepalive przy zamykaniu karty). Akcje serwerowe Next sprawdzają
 * Origin same z siebie — zwykłe route handlery nie.
 */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return false
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}
