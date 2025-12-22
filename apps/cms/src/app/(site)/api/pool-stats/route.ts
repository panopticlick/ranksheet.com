import { NextResponse } from 'next/server'
import { getPoolStats } from '@/lib/db/pool'

/**
 * GET /api/pool-stats
 * Returns database connection pool statistics
 *
 * Useful for monitoring and debugging connection pool health
 */
export async function GET() {
  const stats = getPoolStats()

  return NextResponse.json({
    ok: true,
    pool: stats,
    health: {
      // Pool is healthy if waiting count is low and idle count is reasonable
      healthy: stats.waitingCount === 0 && stats.idleCount > 0,
      message:
        stats.waitingCount > 0
          ? `${stats.waitingCount} requests waiting for connection`
          : stats.idleCount === 0
            ? 'No idle connections available'
            : 'Pool is healthy',
    },
  })
}
