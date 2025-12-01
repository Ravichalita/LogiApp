/** @type {import('next').NextConfig} */
const nextConfig = {
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
  // This is required for Server Actions to work with the Firebase Admin SDK
  serverExternalPackages: ['firebase-admin'],
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

module.exports = nextConfig;
