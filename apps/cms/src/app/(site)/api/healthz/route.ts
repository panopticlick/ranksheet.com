import { NextRequest, NextResponse } from 'next/server'

import { getDbPool } from '@/lib/db/pool'
import { env } from '@/lib/env'
import { kickJobWorker } from '@/lib/jobs/jobQueue'
import { logger } from '@/lib/logger'
import { getRedis } from '@/lib/redis/client'

interface HealthCheck {
  ok: boolean
  detail?: string
  latency_ms?: number
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const checks: Record<string, HealthCheck> = {}
  const errors: string[] = []

  // Check PostgreSQL
  try {
    const pgStart = Date.now()
    const pool = getDbPool()
    await pool.query('SELECT 1')
    checks.postgres = { ok: true, latency_ms: Date.now() - pgStart }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    checks.postgres = { ok: false, detail: message }
    errors.push(`Postgres: ${message}`)
    logger.error({ err }, 'PostgreSQL health check failed')
  }

  // Check Redis
  try {
    const redisStart = Date.now()
    const redis = getRedis()
    if (!redis) {
      checks.redis = { ok: true, detail: 'disabled' }
    } else {
      await redis.ping()
      checks.redis = { ok: true, latency_ms: Date.now() - redisStart }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    checks.redis = { ok: false, detail: message }
    errors.push(`Redis: ${message}`)
    logger.error({ err }, 'Redis health check failed')
  }

  // Optional: Kick job worker
  const url = new URL(request.url)
  if (url.searchParams.get('jobs') === '1') {
    kickJobWorker()
  }

  // Deep health check - test upstream APIs
  const deep = url.searchParams.get('deep') === '1'
  if (deep) {
    // FastAPI check
    try {
      const fastapiStart = Date.now()
      const response = await fetch(`${env.FASTAPI_URL}/health`, {
        signal: AbortSignal.timeout(5000),
      })
      checks.fastapi = {
        ok: response.ok,
        detail: response.ok ? undefined : `HTTP ${response.status}`,
        latency_ms: Date.now() - fastapiStart,
      }
      if (!response.ok) {
        errors.push(`FastAPI: HTTP ${response.status}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown'
      checks.fastapi = { ok: false, detail: message }
      errors.push(`FastAPI: ${message}`)
      logger.warn({ err }, 'FastAPI health check failed')
    }

    // Express API check
    try {
      const expressStart = Date.now()
      const response = await fetch(`${env.EXPRESS_URL}/health`, {
        signal: AbortSignal.timeout(5000),
      })
      checks.express = {
        ok: response.ok,
        detail: response.ok ? undefined : `HTTP ${response.status}`,
        latency_ms: Date.now() - expressStart,
      }
      if (!response.ok) {
        errors.push(`Express: HTTP ${response.status}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown'
      checks.express = { ok: false, detail: message }
      errors.push(`Express: ${message}`)
      logger.warn({ err }, 'Express API health check failed')
    }
  }

  const healthy = checks.postgres?.ok && checks.redis?.ok && (!deep || (checks.fastapi?.ok && checks.express?.ok))

  const response = {
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    latency_ms: Date.now() - startedAt,
    checks,
    errors: errors.length > 0 ? errors : undefined,
  }

  return NextResponse.json(response, {
    status: healthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
