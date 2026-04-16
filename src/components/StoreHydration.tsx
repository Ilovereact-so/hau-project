'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import useStore, { flushPendingSync } from 'store'
import { mergeGuestCart } from '@/actions/sync'
import { GetSlugProduct } from 'sanity.types'

async function hydrateWishlistFromServer() {
  const res = await fetch('/api/wishlist', { cache: 'no-store' })
  const { ids, products }: { ids: string[], products: GetSlugProduct[] } = await res.json()
  useStore.getState().hydrateWishlist(ids, products)
}

export function StoreHydration() {
  const { isSignedIn, userId } = useAuth()
  const prevUserIdRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const prevUserId = prevUserIdRef.current
    prevUserIdRef.current = userId ?? null

    const isFirstRun = prevUserId === undefined

    // ── wylogowanie ─────────────────────────────────
    if (!isFirstRun && prevUserId && !isSignedIn) {
      flushPendingSync().then(() => {
        useStore.getState().clearWishlistState()
        useStore.getState().resetCart()
      })
      return
    }

    // ── zmiana użytkownika ───────────────────────────
    if (!isFirstRun && prevUserId && userId && prevUserId !== userId) {
      flushPendingSync().then(() => {
        useStore.getState().clearWishlistState()
        useStore.getState().resetCart()
        hydrateWishlistFromServer().catch(console.error)
        mergeGuestCart().catch(console.error)
      })
      return
    }

    // ── pierwsze załadowanie lub odświeżenie ─────────
    if (isSignedIn) {
      hydrateWishlistFromServer().catch(console.error)
      mergeGuestCart().catch(console.error)
    } else {
      // niezalogowany — czyść wishlist (mogła zostać z poprzedniej sesji)
      useStore.getState().clearWishlistState()
    }

  }, [isSignedIn, userId])

  return null
}