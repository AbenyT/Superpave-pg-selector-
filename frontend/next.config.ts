import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The calculation engine and the file reader are workspace packages shared with the API.
  transpilePackages: ['@pg/engine', '@pg/parser'],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async headers() {
    // Always show the newest page after an update.
    return [{ source: '/:path*', headers: [{ key: 'Cache-Control', value: 'no-cache' }] }];
  },
};

export default nextConfig;
