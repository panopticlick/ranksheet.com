import { NextRequest, NextResponse } from 'next/server'

import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

export function middleware(request: NextRequest) {
  const start = Date.now()
  const requestId = crypto.randomUUID()
  const { pathname } = request.nextUrl

  // Handle CORS for public API routes
  if (pathname.startsWith('/api/public')) {
    const origin = request.headers.get('origin')
    const allowedOrigins = [
      'https://ranksheet.com',
      'https://www.ranksheet.com',
      ...(env.NODE_ENV === 'development' ? ['http://localhost:3002', 'http://localhost:3003'] : []),
    ]

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 204 })
      if (origin && allowedOrigins.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin)
        response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.set('Access-Control-Max-Age', '86400')
      }
      return response
    }

    // Add CORS headers to actual requests
    const response = NextResponse.next()
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
      response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      response.headers.set('Access-Control-Allow-Credentials', 'true')
    }

    // Add request ID
    response.headers.set('x-request-id', requestId)

    // Security headers for public API routes
    response.headers.set('x-content-type-options', 'nosniff')
    response.headers.set('x-frame-options', 'DENY') // Public APIs should not be framed
    response.headers.set('referrer-policy', 'no-referrer') // Don't send referrer for public APIs

    // Strict CSP for public API (JSON only, no scripts)
    response.headers.set('content-security-policy', "default-src 'none'; frame-ancestors 'none'")

    // Log request
    Promise.resolve().then(() => {
      const duration = Date.now() - start
      const { search } = request.nextUrl

      logger.info(
        {
          type: 'http_request',
          method: request.method,
          pathname,
          search,
          status: response.status,
          duration,
          requestId,
          origin,
          userAgent: request.headers.get('user-agent'),
        },
        'HTTP request completed',
      )
    })

    return response
  }

  // Default middleware for non-public APIs
  const response = NextResponse.next()
  response.headers.set('x-request-id', requestId)

  // Security headers (all routes)
  if (env.NODE_ENV === 'production') {
    // HSTS: Force HTTPS for 1 year
    response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains; preload')
  }

  // Prevent MIME type sniffing
  response.headers.set('x-content-type-options', 'nosniff')

  // Prevent clickjacking (allow same-origin for Payload admin)
  response.headers.set('x-frame-options', 'SAMEORIGIN')

  // Enable browser XSS protection
  response.headers.set('x-xss-protection', '1; mode=block')

  // Control referrer information
  response.headers.set('referrer-policy', 'strict-origin-when-cross-origin')

  // Disable unnecessary browser features
  response.headers.set(
    'permissions-policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  )

  // Content-Security-Policy for admin routes
  // Note: Payload CMS requires 'unsafe-inline' and 'unsafe-eval' for admin UI
  const isAdminRoute = pathname.startsWith('/admin')
  if (isAdminRoute) {
    response.headers.set(
      'content-security-policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: blob:",
        "font-src 'self' data:",
        "connect-src 'self' https://o4507927253778432.ingest.us.sentry.io",
        "frame-src 'self'",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    )
  }

  // Log request asynchronously
  Promise.resolve().then(() => {
    const duration = Date.now() - start
    const { search } = request.nextUrl

    logger.info(
      {
        type: 'http_request',
        method: request.method,
        pathname,
        search,
        status: response.status,
        duration,
        requestId,
        userAgent: request.headers.get('user-agent'),
      },
      'HTTP request completed',
    )
  })

  return response
}

// Apply middleware to API routes only
export const config = {
  matcher: '/api/:path*',
}
