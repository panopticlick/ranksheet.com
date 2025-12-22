import { withPayload } from '@payloadcms/next/withPayload'

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  generateEtags: true,
  transpilePackages: ['@ranksheet/shared'],
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },
}

export default withPayload(nextConfig)
