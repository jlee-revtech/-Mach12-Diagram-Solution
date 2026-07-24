import type { NextConfig } from 'next'
import pkg from './package.json' with { type: 'json' }

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  // 057: the workshop-screenshot capture route runs Playwright (playwright-core +
  // @sparticuz/chromium). Keep them out of the server bundle so the native
  // Chromium binary + brotli assets load at runtime instead of being traced.
  serverExternalPackages: ['@sparticuz/chromium', 'playwright-core'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default nextConfig
