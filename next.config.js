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
  }
  
  module.exports = nextConfig
  