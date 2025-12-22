import { NextResponse } from 'next/server'
import crypto from 'node:crypto'

import { getRedis } from '@/lib/redis/client'
import { logger } from '@/lib/logger'
import { getClientIp } from '@/lib/security/ip'

type CachedResponse = {
  status: number
  body: unknown
  headers: Record<string, string>
}

/**
 * Enforces idempotency for API endpoints using Redis cache.
 * Accepts optional `Idempotency-Key` header. If provided and a cached response exists,
 * returns the cached response immediately without executing the handler.
 *
 * Security enhancements:
 * - Keys are contextual (includes method, path, client IP) to prevent cross-request reuse
 * - Keys are hashed with SHA-256 for consistent length and unpredictability
 * - TTL-based expiration prevents indefinite key retention
 * - Graceful degradation if Redis unavailable
 *
 * @param request - The incoming request
 * @param handler - The async function to execute if no cached response exists
 * @param ttlSeconds - Cache TTL in seconds (default: 86400 = 24 hours)
 * @returns The cached or fresh NextResponse
 */
export async function withIdempotency(
  request: Request,
  handler: () => Promise<NextResponse>,
  ttlSeconds: number = 86400, // 24 hours
): Promise<NextResponse> {
  const redis = getRedis()

  // If Redis not available, execute handler directly (degraded mode)
  if (!redis) {
    logger.warn('idempotency_disabled_no_redis')
    return await handler()
  }

  const idempotencyKey = request.headers.get('idempotency-key')

  // If no idempotency key provided, execute handler directly
  if (!idempotencyKey) {
    return await handler()
  }

  // Validate idempotency key format (must be non-empty, max 255 chars)
  const trimmedKey = idempotencyKey.trim()
  if (!trimmedKey || trimmedKey.length > 255) {
    return NextResponse.json(
      { ok: false, error: 'invalid_idempotency_key' },
      { status: 400 }
    )
  }

  // Security enhancement: Include request context to prevent key reuse across different requests
  // This makes the idempotency key contextual and prevents prediction attacks
  const requestUrl = new URL(request.url)
  const clientIp = getClientIp(request) || 'unknown'
  const contextualKey = [
    trimmedKey,
    request.method,
    requestUrl.pathname,
    clientIp,
  ].join('|')

  // Hash the contextual key to ensure consistent length and unpredictability
  const keyHash = crypto.createHash('sha256').update(contextualKey).digest('hex')
  const cacheKey = `rs:idempotency:${keyHash}`

  try {
    // Check if cached response exists
    const cached = await redis.get(cacheKey)

    if (cached) {
      logger.debug({ keyHash }, 'idempotency_cache_hit')
      const cachedResponse: CachedResponse = JSON.parse(cached)

      return NextResponse.json(
        cachedResponse.body,
        {
          status: cachedResponse.status,
          headers: {
            ...cachedResponse.headers,
            'X-Idempotency-Cache': 'HIT',
          },
        }
      )
    }

    // No cached response, execute handler
    logger.debug({ keyHash }, 'idempotency_cache_miss')
    const response = await handler()

    // Cache the response
    const responseBody = await response.json().catch(() => ({}))
    const responseHeaders: Record<string, string> = {}

    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    const cachePayload: CachedResponse = {
      status: response.status,
      body: responseBody,
      headers: responseHeaders,
    }

    await redis.setex(cacheKey, ttlSeconds, JSON.stringify(cachePayload))

    // Return a new response with the same data plus cache header
    return NextResponse.json(
      responseBody,
      {
        status: response.status,
        headers: {
          ...responseHeaders,
          'X-Idempotency-Cache': 'MISS',
        },
      }
    )
  } catch (err) {
    logger.error({ err, keyHash }, 'idempotency_error')
    // On error, execute handler directly
    return await handler()
  }
}
