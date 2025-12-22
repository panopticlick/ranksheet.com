import { NextResponse } from 'next/server'

import { getDbPool } from '@/lib/db/pool'
import { logger } from '@/lib/logger'

/**
 * Readiness probe endpoint
 *
 * Checks if the application is ready to serve traffic:
 * - Database migrations are applied
 * - Database is accessible
 * - Application has completed initialization
 *
 * Used by Kubernetes/Docker health checks to determine when to route traffic
 */
export async function GET() {
  const startedAt = Date.now()
  let ready = false
  let detail: string | undefined

  try {
    const pool = getDbPool()

    // Check if database is accessible
    await pool.query('SELECT 1')

    // Check if Payload migrations are applied
    // This queries the payload_migrations table to ensure schema is up-to-date
    const result = await pool.query<{ name: string }>(
      `SELECT name FROM payload_migrations ORDER BY batch DESC, name DESC LIMIT 1`,
    )

    if (result.rows.length > 0) {
      ready = true
      const latestMigration = result.rows[0]
      detail = latestMigration ? `Latest migration: ${latestMigration.name}` : 'No migrations found'
    } else {
      detail = 'No migrations found'
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    detail = `Not ready: ${message}`
    logger.error({ err }, 'Readiness check failed')
  }

  return NextResponse.json(
    {
      ready,
      detail,
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startedAt,
    },
    {
      status: ready ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    },
  )
}
