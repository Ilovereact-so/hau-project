'use client'

import * as React from 'react'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { Toaster } from 'react-hot-toast'
import { cn } from '../kit/utils'
import { Sidebar, type AdminUser } from './Sidebar'
import { Topbar } from './Topbar'
import { AdminCounters, THEME_COOKIE, activeLabelFor, headingFor } from './navigation'
import { AdminSessionGuard } from './AdminSessionGuard'

const COLLAPSE_KEY = 'hau_admin_sidebar_collapsed'

/**
 * Okno aplikacji „unoszone” nad tłem strony (układ meblove): zaokrąglona
 * ramka z miękkim cieniem, wewnątrz sidebar + treść. Element z klasą
 * `hau-admin` jest nośnikiem tokenów motywu — wszystko, co ma wyglądać jak
 * panel (także modale i toasty), musi się renderować w jego wnętrzu.
 */
export function AdminShell(props: {
  user: AdminUser
  counters: AdminCounters
  initialDark: boolean
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<ShellFrame {...props} pathname="" search={new URLSearchParams()} />}>
      <ShellWithRoute {...props} />
    </Suspense>
  )
}

function ShellWithRoute(props: {
  user: AdminUser
  counters: AdminCounters
  initialDark: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const search = useSearchParams()
  return <ShellFrame {...props} pathname={pathname} search={new URLSearchParams(search.toString())} />
}

function ShellFrame({
  user,
  counters,
  initialDark,
  children,
  pathname,
  search,
}: {
  user: AdminUser
  counters: AdminCounters
  initialDark: boolean
  children: React.ReactNode
  pathname: string
  search: URLSearchParams
}) {
  const router = useRouter()
  const { signOut } = useClerk()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [isDark, setIsDark] = useState(initialDark)

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1')
    } catch {
      /* prywatne okno / zablokowany storage — zostaje rozwinięty */
    }
  }, [])

  const toggleCollapsed = () =>
    setCollapsed((value) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, value ? '0' : '1')
      } catch {
        /* brak storage nie może wywrócić UI */
      }
      return !value
    })

  /* Motyw w ciasteczku, nie w localStorage: layout czyta je na serwerze,
     więc ciemny panel nie mignie na biało przy przeładowaniu. */
  const toggleTheme = () =>
    setIsDark((value) => {
      document.cookie = `${THEME_COOKIE}=${value ? 'light' : 'dark'}; path=/admin; max-age=31536000; samesite=lax`
      return !value
    })

  useEffect(() => {
    if (!mobileNavOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileNavOpen])

  /* Liczby na dashboardzie i liczniki w sidebarze zmieniają się w trakcie
     pracy (sklep przyjmuje zamówienia). Odświeżamy dane serwerowe co 60 s,
     po cichu i tylko w widocznej karcie. Najpierw świeży token sesji: po powrocie
     do karty, która stała w tle, ciasteczko Clerka bywa przeterminowane, a
     odświeżenie z takim ciasteczkiem kończyło się ekranem logowania. (Bez
     `freshSessionToken` z lib/adminRequest — ono liczy się jako aktywność,
     a automatyczne odświeżanie nie może blokować wylogowania po bezczynności.) */
  const refresh = useCallback(async () => {
    if (document.hidden) return
    await window.Clerk?.session?.getToken().catch(() => null)
    if (!document.hidden) router.refresh()
  }, [router])
  useEffect(() => {
    const run = () => void refresh()
    const timer = window.setInterval(run, 60_000)
    document.addEventListener('visibilitychange', run)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', run)
    }
  }, [refresh])

  const activeLabel = activeLabelFor(pathname, search)
  const heading = headingFor(pathname, user.name.split(' ')[0])

  const renderSidebar = (isCollapsed: boolean) => (
    <Sidebar
      activeLabel={activeLabel}
      pathname={pathname}
      search={search}
      collapsed={isCollapsed}
      onToggleCollapse={toggleCollapsed}
      isDark={isDark}
      onToggleTheme={toggleTheme}
      onNavigate={() => setMobileNavOpen(false)}
      onLogout={() => void signOut({ redirectUrl: '/' })}
      user={user}
      counters={counters}
    />
  )

  return (
    <div className={cn('hau-admin min-h-screen', isDark && 'dark')}>
      <div className="min-h-screen bg-gradient-to-br from-shell to-shell2 p-0 md:p-4 lg:p-6">
        <div
          className={cn(
            'mx-auto flex w-full max-w-[1560px] overflow-hidden bg-surface',
            'h-screen md:h-[calc(100vh-2rem)] lg:h-[calc(100vh-3rem)]',
            'md:rounded-[30px] md:border-3 md:border-surface-muted md:shadow-window'
          )}
        >
          {/* Desktop: stała kolumna nawigacji */}
          <div
            className={cn(
              'hidden shrink-0 transition-[width] duration-200 ease-(--ease) md:block',
              collapsed ? 'w-[68px]' : 'w-[248px]'
            )}
          >
            <div className="sticky top-0 h-full">{renderSidebar(collapsed)}</div>
          </div>

          <main className="flex min-w-0 flex-1 flex-col overflow-auto bg-bg">
            <Suspense fallback={null}>
              <Topbar
                title={heading.title}
                subtitle={heading.subtitle}
                onOpenNav={() => setMobileNavOpen(true)}
                toShip={counters.toShip}
              />
            </Suspense>
            <div className="flex-1 px-4 pt-3 pb-6 sm:px-5 lg:px-7 lg:pb-8">{children}</div>
          </main>
        </div>

        {/* Mobile: nawigacja jako panel wysuwany */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label="Zamknij nawigację"
              className="absolute inset-0 bg-[#0F172A]/40 animate-fade-in"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-[272px] max-w-[85vw] bg-surface shadow-2 animate-fade-in">
              {/* Wysuwany panel zawsze w pełnej szerokości — zwinięcie dotyczy tylko desktopu. */}
              {renderSidebar(false)}
            </div>
          </div>
        )}
      </div>

      <AdminSessionGuard />

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            fontSize: '13px',
            borderRadius: '10px',
            padding: '10px 14px',
            background: 'var(--adm-surface)',
            color: 'var(--adm-text)',
            border: '1px solid var(--adm-border)',
            boxShadow: 'var(--adm-shadow-2)',
          },
        }}
      />
    </div>
  )
}
