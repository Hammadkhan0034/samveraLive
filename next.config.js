/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
      serverActions: true,
    },
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
  }
  
  module.exports = nextConfig
  