'use client'

import { createContext, useContext } from 'react'
import { useAuth } from '@clerk/nextjs'

// Stan zalogowania dla sekcji profilu. Serwer (layout profilu) podaje wartość
// początkową, więc pierwszy render — także SSR — od razu pokazuje właściwy
// wariant (gość / konto) bez mignięcia. Po załadowaniu Clerka decyduje klient
// (np. wylogowanie w innej karcie).

const InitialSignedInContext = createContext<boolean>(false)

export function ProfileSessionProvider({
  initialSignedIn, children,
}: { initialSignedIn: boolean; children: React.ReactNode }) {
  return (
    <InitialSignedInContext.Provider value={initialSignedIn}>
      {children}
    </InitialSignedInContext.Provider>
  )
}

export function useProfileIsGuest(): boolean {
  const initialSignedIn = useContext(InitialSignedInContext)
  const { isLoaded, isSignedIn } = useAuth()
  return isLoaded ? !isSignedIn : !initialSignedIn
}

/** Ścieżki profilu dostępne bez logowania. */
export const GUEST_PROFILE_PATHS = ['/profile/wishlist'] as const
