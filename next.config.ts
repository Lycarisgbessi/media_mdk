import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Vérification TypeScript active au build (aucune erreur dans src/).
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
};

export default nextConfig;
