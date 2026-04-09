import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: false,
  images: {
    domains: [], // Add domains for external images if needed
  },
  // Vercel-specific options
  // This option ensures your app runs optimally on Vercel
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "*.vercel.app"],
    },
  },
  // Temporarily disable ESLint during builds
  eslint: {
    // Only run ESLint on these directories during production builds
    dirs: ['app', 'components', 'lib', 'types'], 
    // Warning only (doesn't fail the build)
    ignoreDuringBuilds: true,
  },
  // Temporarily disable TypeScript type checking during builds
  typescript: {
    // Warning only (doesn't fail the build)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
