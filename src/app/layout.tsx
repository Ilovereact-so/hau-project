import type { Metadata, Viewport } from "next";
import { Poppins, Fredoka } from "next/font/google";
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

const poppins = Poppins({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
  preload: false,
});

const fredoka = Fredoka({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fredoka',
  preload: false,
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1.5,
  userScalable: true,
  themeColor: '#1a1a1a',
}

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
  icons: { icon: "/favicon.ico" },
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