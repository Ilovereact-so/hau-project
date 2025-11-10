import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Wyłączenie sprawdzania ESLint podczas buildu
  eslint: {
    ignoreDuringBuilds: true,
  },
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

};

export default nextConfig;
