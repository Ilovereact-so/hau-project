import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Wyłączenie sprawdzania ESLint podczas buildu
  eslint: {
    ignoreDuringBuilds: true,
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
    ],
  },
  // Optymalizacja dla produkcji
  swcMinify: true,
  poweredByHeader: false,
};

export default nextConfig;
