'use client'

import { usePathname } from 'next/navigation'

interface Props {
  children:  React.ReactNode
  topBar:    React.ReactNode
  navbar:    React.ReactNode
  carousel:  React.ReactNode
  footer:    React.ReactNode
  footerCheckout: React.ReactNode
}

// Strony w grupie (client), na których karuzela "polecanych" produktów nie ma
// sensu i wcześniej i tak się renderowała: konto/zamówienia (transakcyjne, nie
// przeglądowe) i strona podziękowania po płatności. Każdy mount to jedno
// zapytanie GROQ (dość ciężkie — pełna projekcja produktu) plus obrazki
// wyrenderowanych produktów — realne, zbędne requesty przy wejściu na te
// zakładki. Cart i wishlist zostają — tam rekomendacja "dokup coś jeszcze" ma
// sens.
const CAROUSEL_FREE_PREFIXES = ['/checkout', '/success', '/orders']

export default function ClientLayoutShell({ children, topBar, navbar, carousel, footer, footerCheckout }: Props) {
  const pathname = usePathname()
  const isCheckout = pathname === '/checkout'
  const hideCarousel = CAROUSEL_FREE_PREFIXES.some(prefix => pathname.startsWith(prefix))

  return (
    <div className="flex flex-col min-h-screen justify-between">
      <div>
      {topBar}
      {!isCheckout && navbar}
      {children}
      {!hideCarousel && carousel}
      </div>
      { isCheckout ? footerCheckout : footer}
    </div>
  )
}
