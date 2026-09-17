'use client'

import { useCallback, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Filtry list w panelu żyją w adresie (?status=…&page=…), więc odświeżenie,
 * zakładka i „wstecz” pokazują ten sam widok. Zmiana filtra wraca na 1. stronę.
 */
export function useQueryNav() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const get = useCallback((key: string) => params.get(key) ?? '', [params])

  const set = useCallback(
    (changes: Record<string, string | null | undefined>, { keepPage = false } = {}) => {
      const next = new URLSearchParams(params.toString())
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      if (!keepPage && !('page' in changes)) next.delete('page')
      const query = next.toString()
      startTransition(() => {
        router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
      })
    },
    [params, pathname, router]
  )

  const refresh = useCallback(() => startTransition(() => router.refresh()), [router])

  return { get, set, refresh, pending, params }
}
