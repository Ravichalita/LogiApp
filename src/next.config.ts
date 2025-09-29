
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // This is required for Server Actions to work with the Firebase Admin SDK
  // It is disabled when using Turbopack, as it can cause issues.
  ...(!process.env.TURBOPACK && { serverExternalPackages: ['firebase-admin'] }),
  experimental: {
    
  },
  // Redirect root to /os
  async redirects() {
    return [
      {
        source: '/',
        destination: '/os',
        permanent: true,
      },
    ];
  },
  // Allow the service worker to be served from the public directory
  async rewrites() {
    return [
      {
        source: '/firebase-messaging-sw.js',
        destination: '/_next/static/firebase-messaging-sw.js',
      },
    ];
  },
};

export default nextConfig;
