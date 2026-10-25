import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { StoreHydration } from "@/components/StoreHydration";
import AuthModal from "@/components/auth/AuthModal";
import AuthQueryTrigger from "@/components/auth/AuthQueryTrigger";
import { Suspense } from "react";
import { SITE_DESCRIPTION, SITE_INDEXABLE, SITE_LOCALE, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import CookieConsent from "@/components/consent/CookieConsent";
import { reportEnvOnce } from "@/lib/env";
import Analytics from "@/components/consent/Analytics";

/* Fonty są w repozytorium (src/fonts, scripts/build-fonts.py), nie z Google:
   `next/font/google` pobierał je przy każdym buildzie i zmiana odpowiedzi Google
   wywracała build w CI. Fredoka nie ma polskich znaków (także u Google) —
   „ą/ę/ś…” przeglądarka bierze z fontu zapasowego. */
const poppins = localFont({
  src: [
    { path: '../fonts/poppins-400.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/poppins-500.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/poppins-600.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-poppins',
  preload: false,
  fallback: ['system-ui', 'sans-serif'],
});

const fredoka = localFont({
  src: '../fonts/fredoka-variable.woff2',
  weight: '400 600',
  style: 'normal',
  display: 'swap',
  variable: '--font-fredoka',
  preload: false,
  fallback: ['system-ui', 'sans-serif'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1.5,
  userScalable: true,
  themeColor: '#1a1a1a',
}

/** Wersja plików ikon w public/ (favicon, apple-touch-icon, icon-*.png). */
const ICON_VERSION = "3";

export const metadata: Metadata = {
  // Wszystkie względne adresy w metadanych (kanoniczne, OG) rozwijają się
  // względem tego adresu — bez niego Next zgłasza ostrzeżenie, a linki
  // w podglądach social media są względne i nie działają.
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    // Podstrony podają sam tytuł, resztę dokłada szablon.
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
  // Na staging (SITE_INDEXABLE=false) domyślna reguła dla całego serwisu to
  // `noindex` — kopia sklepu pod inną domeną nie może konkurować z produkcją.
  robots: SITE_INDEXABLE
    ? {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
      }
    : { index: false, follow: false, googleBot: { index: false, follow: false } },
  // Ikony leżą w public/ (NIE w src/app — plik o tej samej nazwie w obu
  // miejscach to błąd 500 „conflicting public file and page file”; pilnuje tego
  // scripts/checkPublicConflicts.mjs). `?v=` wymusza pobranie nowej ikony:
  // przeglądarki trzymają faviconę tygodniami, także zapamiętany błąd.
  // Podbij ICON_VERSION przy każdej zmianie plików ikon.
  icons: {
    icon: [
      { url: `/favicon.ico?v=${ICON_VERSION}`, sizes: "any" },
      { url: `/icon-192.png?v=${ICON_VERSION}`, type: "image/png", sizes: "192x192" },
    ],
    shortcut: `/favicon.ico?v=${ICON_VERSION}`,
    apple: { url: `/apple-touch-icon.png?v=${ICON_VERSION}`, sizes: "180x180" },
  },
  manifest: "/manifest.webmanifest",
  formatDetection: { telephone: false },
  // Kod weryfikacyjny Google Search Console — wystarczy wpisać go w .env.
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Raport braków w `.env` — raz na proces, do logów serwera (tylko produkcja).
  reportEnvOnce();
  return (
    <ClerkProvider>
      <html lang="pl" className={`${poppins.variable} ${fredoka.variable}`}>
        <body className={`antialiased overflow-x-hidden`}>
          <StoreHydration />  {/* ← wewnątrz ClerkProvider */}
          <AuthModal />
          {/* ?login=1&redirect_url=… → modal logowania (useSearchParams wymaga Suspense) */}
          <Suspense fallback={null}>
            <AuthQueryTrigger />
          </Suspense>
          {children}
          {/* Zgody na cookies: baner + panel ustawień. Skrypty analityczne
              (Analytics) uruchamiają się dopiero po zgodzie — patrz lib/consent.ts. */}
          <CookieConsent />
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
