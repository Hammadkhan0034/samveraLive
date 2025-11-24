/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config) => {
      // Ignore "Critical dependency: the request of a dependency is an expression" warnings
      config.ignoreWarnings = [
        {
          module: /@supabase/,
          message: /Critical dependency/,
        },
      ]
      return config
    },
    // Turbopack config - empty for now, using webpack for Supabase warning suppression
    turbopack: {},
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: '**.supabase.co',
        },
        {
          protocol: 'https',
          hostname: '**.supabase.in',
        },
      ],
    },
    async rewrites() {
      return [
        {
          source: '/firebase-messaging-sw.js',
          destination: '/api/firebase-messaging-sw.js',
        },
      ]
    },
  }
  
  module.exports = nextConfig
  