// src/context/wishlist-context.tsx
'use client'

import {
  createContext, useContext, useOptimistic,
  useTransition, useState, useEffect,
  useCallback
} from 'react'
import { toggleWishlist, getWishlist } from '@/actions/wishlist'
import { debounce } from '@/lib/debounce'

type WishlistContextType = {
  isWishlisted: (productId: string) => boolean
  toggle:       (productId: string) => Promise<void>
  isPending:    boolean
}

const WishlistContext = createContext<WishlistContextType | null>(null)

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(new Set())
  const [isPending, setIsPending] = useState(false)

  const debouncedSync = useCallback(
    debounce(async (productId: string, shouldAdd: boolean) => {
      setIsPending(true)
      try {
        const result = await toggleWishlist(productId)
        
        // Na wypadek gdyby serwer zwrócił coś innego niż myśleliśmy,
        // synchronizujemy stan z odpowiedzią serwera
        setIds(prev => {
          const next = new Set(prev)
          if (result.wishlisted) next.add(productId)
          else next.delete(productId)
          return next
        })
      } catch (error) {
        console.error(error)
        // W przypadku błędu cofamy zmianę w UI
        setIds(prev => {
          const next = new Set(prev)
          if (shouldAdd) next.delete(productId)
          else next.add(productId)
          return next
        })
      } finally {
        setIsPending(false)
      }
    }, 400),
    []
  )
  // ładuj tylko raz, tylko po stronie klienta, tylko gdy zalogowany
  useEffect(() => {
    fetch('/api/wishlist')
      .then(r => r.json())
      .then(ids => setIds(new Set(ids)))
  }, [])

  async function toggle(productId: string) {
    const shouldAdd = !ids.has(productId)

    // 1. NATYCHMIAST aktualizujemy UI (nasz własny Optimistic Update)
    setIds(prev => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })

    // 2. Wywołujemy debounced strzał do API
    debouncedSync(productId, shouldAdd)
  }

  return (
    <WishlistContext.Provider value={{
      isWishlisted: (id) => ids.has(id),
      toggle,
      isPending,
    }}>
      {children}
    </WishlistContext.Provider>
  )
}

export function useWishlist() {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist musi być wewnątrz WishlistProvider')
  return ctx
}