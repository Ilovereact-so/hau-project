'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { useAuthModalStore } from '@/store/authModalStore'
import { sanitizeRedirect } from '@/lib/authRedirect'

/**
 * Obsługuje `?login=1[&redirect_url=/…]` na dowolnej stronie:
 *  - gość → otwiera modal logowania (z powrotem na redirect_url),
 *  - zalogowany → od razu przechodzi na redirect_url.
 * Parametry są potem usuwane z paska adresu.
 *
 * Używa useSearchParams — w layoucie musi być owinięty w <Suspense>.
 */
export default function AuthQueryTrigger() {
  const searchParams = useSearchParams()
  const pathname     = usePathname()
  const router       = useRouter()
  const { isLoaded, isSignedIn } = useAuth()
  const openModal    = useAuthModalStore(s => s.openModal)

  const wantsLogin = searchParams.get('login') === '1'
  const rawTarget  = searchParams.get('redirect_url')

  useEffect(() => {
    if (!wantsLogin || !isLoaded) return

    const target = sanitizeRedirect(rawTarget)
    const rest   = new URLSearchParams(searchParams.toString())
    rest.delete('login')
    rest.delete('redirect_url')
    const query    = rest.toString()
    const cleanUrl = query ? `${pathname}?${query}` : pathname

    if (isSignedIn) {
      router.replace(target ?? cleanUrl)
      return
    }

    openModal('signIn', { redirectTo: target })
    router.replace(cleanUrl, { scroll: false })
  }, [wantsLogin, rawTarget, isLoaded, isSignedIn, pathname, router, searchParams, openModal])

  return null
}
