import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { securityHeaders } from "./src/lib/securityHeaders";

// Wersja Next.js, na której powstaje TA paczka. Trafia do kodu jako
// `process.env.HAU_NEXT_BUILD_VERSION`, a `lib/runtimeCheck.ts` porównuje ją
// z wersją w `node_modules` serwera. Rozjazd (np. nowy build, a na hostingu
// nie kliknięto „Uruchom NPM Install”) daje 500 na favicon, manifeście
// i statycznych trasach /api, choć strony działają.
const nextBuildVersion = (() => {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "node_modules/next/package.json"), "utf8")).version as string;
  } catch {
    return "";
  }
})();

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  env: {
    HAU_NEXT_BUILD_VERSION: nextBuildVersion,
  },
  experimental: {
    middlewareClientMaxBodySize: '100mb', // lub np. '100mb'
    // Panel admina wysyła przez server actions zdjęcia produktów (do 10 MB)
    // i treść CSV do suchej próby importu — domyślny limit to 1 MB.
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
  // Lint pilnuje builda: `npm run lint` jest czysty (same ostrzeżenia), więc
  // realny błąd zatrzyma deploy, zamiast wjechać na produkcję.
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Konfiguracja dla dynamic export
  output: 'standalone',
  
  // Pozostałe opcje
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com' ,
      },
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io' ,
      },
      // Miniatury filmów z YouTube w poradnikach (komponent guides/VideoPlayer).
      // Bez tego wpisu next/image rzuca "hostname is not configured" i kafelek
      // z filmem wywala całą stronę poradnika.
      {
        protocol: 'https',
        hostname: 'i.ytimg.com' ,
      },
    ],
  },
  // Optymalizacja dla produkcji
  poweredByHeader: false,
  compress: true,

  /**
   * Nagłówki bezpieczeństwa (definicje i tryb CSP: src/lib/securityHeaders.ts).
   * Domyślnie CSP idzie jako Report-Only — nic nie blokuje, tylko raportuje
   * w konsoli. Po weryfikacji ustaw CSP_MODE=enforce w .env.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(isDev),
      },
      {
        // Mapa strony i robots — krótki cache po stronie CDN.
        source: "/(sitemap.xml|robots.txt)",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
