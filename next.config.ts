
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // This is required for Server Actions to work with the Firebase Admin SDK
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'],
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
