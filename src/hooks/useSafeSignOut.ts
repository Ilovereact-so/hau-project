'use client'

import { useCallback, useState } from 'react'
import { useClerk } from '@clerk/nextjs'
import { flushPendingSync } from 'store'

/**
 * Wylogowanie, które najpierw zapisuje zaległe zmiany koszyka/wishlisty
 * (debounce 500 ms). Po wylogowaniu zapis byłby już odrzucony przez serwer,
 * więc zmiany zrobione tuż przed kliknięciem "Wyloguj" by przepadły.
 */
export function useSafeSignOut() {
  const { signOut } = useClerk()
  const [pending, setPending] = useState(false)

  const run = useCallback(async (redirectUrl = '/') => {
    if (pending) return
    setPending(true)
    try {
      await flushPendingSync()
    } finally {
      await signOut({ redirectUrl })
      setPending(false)
    }
  }, [pending, signOut])

  return { signOut: run, pending }
}
