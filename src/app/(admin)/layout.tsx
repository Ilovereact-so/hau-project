import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'

/* Fonty panelu z meblove: Inter (tekst) + JetBrains Mono (identyfikatory),
   z repozytorium (src/fonts) — patrz komentarz w src/app/layout.tsx.
   Podpięte jako zmienne CSS i użyte w `.hau-admin` (admin-theme.css),
   żeby nie nadpisywać fontów sklepu. */
const inter = localFont({
  src: '../../fonts/inter-variable.woff2',
  weight: '400 800',
  style: 'normal',
  display: 'swap',
  variable: '--font-adm-sans',
  preload: false,
  fallback: ['system-ui', 'sans-serif'],
})

const mono = localFont({
  src: '../../fonts/jetbrains-mono-variable.woff2',
  weight: '400 500',
  style: 'normal',
  display: 'swap',
  variable: '--font-adm-mono',
  preload: false,
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'monospace'],
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
