import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Strona jest komponentem klienckim, więc tytuł karty ustawia layout.
export const metadata: Metadata = { title: 'Koszyk' }

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
