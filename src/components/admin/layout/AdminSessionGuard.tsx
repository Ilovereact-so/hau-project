'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { useSafeSignOut } from '@/hooks/useSafeSignOut'
import { ADMIN_IDLE_MINUTES, freshSessionToken, lastAdminActivity, markAdminActivity, setAdminSessionId } from '@/lib/adminRequest'
import { Button } from '../kit/Button'

const IDLE_MS = ADMIN_IDLE_MINUTES * 60_000
const WARN_MS = 60_000
const CHECK_MS = 5_000
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const

/**
 * Sesja w panelu admina:
 * 1. Podtrzymanie — po powrocie do karty (i co 45 s w widocznej karcie) bierze
 *    świeży token Clerka, żeby żądania w tle nie szły z przeterminowanym
 *    ciasteczkiem (patrz middleware: `isBackgroundRequest`).
 * 2. Wylogowanie po ADMIN_IDLE_MINUTES bez aktywności (mysz, klawiatura,
 *    przewijanie, żądania panelu — np. trwający import). Aktywność jest wspólna
 *    dla wszystkich kart panelu; minutę wcześniej pojawia się ostrzeżenie.
 */
export function AdminSessionGuard() {
  const { sessionId } = useAuth()
  const pathname = usePathname()
  const { signOut } = useSafeSignOut()
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const loggingOut = useRef(false)

  const logout = useCallback(() => {
    if (loggingOut.current) return
    loggingOut.current = true
    const back = `${window.location.pathname}${window.location.search}`
    void signOut(`/sign-in?reason=idle&redirect_url=${encodeURIComponent(back)}`)
  }, [signOut])

  const check = useCallback(() => {
    setAdminSessionId(sessionId)
    if (!sessionId || loggingOut.current) return
    const last = lastAdminActivity(sessionId)
    if (last === null) {
      markAdminActivity(true) // pierwsze wejście w tej sesji
      setSecondsLeft(null)
      return
    }
    const idle = Date.now() - last
    if (idle >= IDLE_MS) logout()
    else if (idle >= IDLE_MS - WARN_MS) setSecondsLeft(Math.ceil((IDLE_MS - idle) / 1000))
    else setSecondsLeft(null)
  }, [sessionId, logout])

  // Aktywność użytkownika.
  useEffect(() => {
    const onActivity = () => markAdminActivity()
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { passive: true, capture: true })
    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity, { capture: true })
    }
  }, [])

  // Przejście na inną podstronę to aktywność — ale nie samo załadowanie strony
  // (przeładowanie karty po powrocie nie może przedłużać bezczynnej sesji).
  const previousPath = useRef(pathname)
  useEffect(() => {
    if (previousPath.current === pathname) return
    previousPath.current = pathname
    setAdminSessionId(sessionId)
    const last = sessionId ? lastAdminActivity(sessionId) : null
    if (last !== null && Date.now() - last < IDLE_MS) markAdminActivity(true)
  }, [pathname, sessionId])

  // Sprawdzanie bezczynności + podtrzymanie tokenu.
  useEffect(() => {
    check()
    const timer = window.setInterval(check, CHECK_MS)
    const keepAlive = window.setInterval(() => {
      if (!document.hidden) void window.Clerk?.session?.getToken().catch(() => null)
    }, 45_000)
    const onReturn = () => {
      if (document.hidden) return
      check() // najpierw: po długiej nieobecności wylogowanie, nie odświeżenie
      if (!loggingOut.current) void window.Clerk?.session?.getToken().catch(() => null)
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key?.startsWith('hau_admin_last_activity')) check()
    }
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
    window.addEventListener('online', onReturn)
    window.addEventListener('storage', onStorage)
    return () => {
      window.clearInterval(timer)
      window.clearInterval(keepAlive)
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('focus', onReturn)
      window.removeEventListener('online', onReturn)
      window.removeEventListener('storage', onStorage)
    }
  }, [check])

  if (secondsLeft === null) return null

  const stay = () => {
    markAdminActivity(true)
    setSecondsLeft(null)
    void freshSessionToken(true)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F172A]/40 p-4" role="alertdialog" aria-modal="true" aria-labelledby="idle-title">
      <div className="w-full max-w-[380px] rounded-md border border-border bg-surface p-5 shadow-2">
        <h2 id="idle-title" className="m-0 text-[15px] font-semibold text-text">
          Za chwilę wylogujemy Cię z panelu
        </h2>
        <p className="mt-2 mb-4 text-[13px] leading-[1.5] text-text-2">
          Nie było aktywności od {ADMIN_IDLE_MINUTES - 1} minut. Wylogowanie za <strong className="text-text">{secondsLeft} s</strong>.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={logout}>
            Wyloguj teraz
          </Button>
          <Button onClick={stay} autoFocus>
            Zostaję zalogowany
          </Button>
        </div>
      </div>
    </div>
  )
}
