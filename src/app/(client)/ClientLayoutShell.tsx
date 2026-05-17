'use client'

import { usePathname } from 'next/navigation'

interface Props {
  children:  React.ReactNode
  topBar:    React.ReactNode
  navbar:    React.ReactNode
  carousel:  React.ReactNode
  footer:    React.ReactNode
}

export default function ClientLayoutShell({ children, topBar, navbar, carousel, footer }: Props) {
  const isCheckout = usePathname() === '/checkout'

  return (
    <>
      {topBar}
      {!isCheckout && navbar}
      {children}
      {!isCheckout && carousel}
      { footer}
    </>
  )
}
