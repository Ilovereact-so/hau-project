import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'

/* Fonty panelu z meblove: Inter (tekst) + JetBrains Mono (identyfikatory).
   Podpięte jako zmienne CSS i użyte w `.hau-admin` (admin-theme.css),
   żeby nie nadpisywać fontów sklepu. */
const inter = Inter({
  weight: ['400', '500', '600', '700', '800'],
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-adm-sans',
  preload: false,
})

const mono = JetBrains_Mono({
  weight: ['400', '500'],
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-adm-mono',
  preload: false,
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F6F7FB',
}

export const metadata: Metadata = {
  title: { default: 'HAU · Panel', template: '%s · HAU Panel' },
  robots: { index: false, follow: false },
}

export default function AdminGroupLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={`${inter.variable} ${mono.variable}`}>{children}</div>
}
