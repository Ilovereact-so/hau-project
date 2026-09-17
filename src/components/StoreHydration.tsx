'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import useStore, { flushPendingSyncOnPageHide } from 'store'
import {
  loadGuestWishlistProducts, startGuestSession, startUserSession, type Guard,
} from '@/lib/storeSession'

// Logika przejść gość / logowanie / wylogowanie / zmiana konta:
// src/lib/storeSession.ts. Ten komponent tylko reaguje na zmiany sesji Clerka
// i zdarzenia przeglądarki.

const get = () => useStore.getState()

export function StoreHydration() {
  const { isLoaded, userId } = useAuth()
  const prevUserIdRef = useRef<string | null | undefined>(undefined)
  const generationRef = useRef(0)

  useEffect(() => {
    if (!isLoaded) return

    const prevUserId = prevUserIdRef.current
    const nextUserId = userId ?? null
    if (prevUserId === nextUserId) return
    prevUserIdRef.current = nextUserId

    const generation = ++generationRef.current
    const guard: Guard = () => generation !== generationRef.current

    const run = nextUserId
      ? startUserSession(nextUserId, guard)
      : startGuestSession({ afterLogout: !!prevUserId }, guard)

    run.catch(err => console.error('[StoreHydration]', err))
  }, [isLoaded, userId])

  // Zaległe zmiany (debounce 500 ms) wysyłamy przy ukryciu/zamknięciu karty.
  useEffect(() => {
    const onHide = () => flushPendingSyncOnPageHide()
    const onVisibility = () => { if (document.visibilityState === 'hidden') onHide() }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // Zmiany koszyka/wishlisty gościa z innej karty tej samej przeglądarki.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== useStore.persist.getOptions().name) return
      const before = get().guestWishlistIds.join(',')
      Promise.resolve(useStore.persist.rehydrate()).then(() => {
        const s = get()
        if (s.session.status !== 'guest' || s.guestWishlistIds.join(',') === before) return
        useStore.setState({ wishlistIds: s.guestWishlistIds })
        const generation = generationRef.current
        loadGuestWishlistProducts(() => generation !== generationRef.current).catch(console.error)
      })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return null
}
