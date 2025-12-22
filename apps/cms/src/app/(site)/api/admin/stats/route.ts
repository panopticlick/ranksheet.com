import { NextResponse } from 'next/server'

import { requireJobAuth } from '@/lib/auth/jobToken'
import { getDbPool, getPoolStats } from '@/lib/db/pool'
import { getPayloadClient } from '@/lib/payload/client'

type StatsResponse = {
  ok: true
  timestamp: string
  keywords: {
    total: number
    byStatus: Record<string, number>
    byCategory: Record<string, number>
    active: number
    contentGenerated: number
  }
  sheets: {
    total: number
    byReadiness: Record<string, number>
    byMode: Record<string, number>
    avgValidCount: number
  }
  cache: {
    total: number
    byStatus: Record<string, number>
    expiringSoon: number // within 7 days
    expired: number
  }
  jobs: {
    queued: number
    running: number
    completed24h: number
    failed24h: number
    avgDurationMs: number | null
  }
  pool: {
    totalCount: number
    idleCount: number
    waitingCount: number
    initialized: boolean
  }
}

export async function GET(request: Request) {
  const unauthorized = requireJobAuth(request)
  if (unauthorized) return unauthorized

  try {
    const payload = await getPayloadClient()
    const pool = getDbPool()

    // Run all queries in parallel for better performance
    const [
      keywordsTotal,
      keywordsByStatus,
      keywordsByCategory,
      keywordsActive,
      keywordsContentGenerated,
      sheetsTotal,
      sheetsByReadiness,
      sheetsByMode,
      sheetsAvgValid,
      cacheStats,
      jobStats,
    ] = await Promise.all([
      // Keywords total
      payload.count({ collection: 'keywords', overrideAccess: true }),

      // Keywords by status
      pool.query<{ status: string; count: string }>(`
        SELECT status, COUNT(*)::text as count
        FROM ranksheet.keywords
        GROUP BY status
      `),

      // Keywords by category
      pool.query<{ category: string; count: string }>(`
        SELECT category, COUNT(*)::text as count
        FROM ranksheet.keywords
        WHERE category IS NOT NULL
        GROUP BY category
      `),

      // Keywords active count
      payload.count({
        collection: 'keywords',
        where: { isActive: { equals: true } },
        overrideAccess: true,
      }),

      // Keywords with content generated
      payload.count({
        collection: 'keywords',
        where: { contentGenerated: { equals: true } },
        overrideAccess: true,
      }),

      // Sheets total
      payload.count({ collection: 'rank-sheets', overrideAccess: true }),

      // Sheets by readiness level
      pool.query<{ readiness_level: string; count: string }>(`
        SELECT readiness_level, COUNT(*)::text as count
        FROM ranksheet.rank_sheets
        WHERE readiness_level IS NOT NULL
        GROUP BY readiness_level
      `),

      // Sheets by mode
      pool.query<{ mode: string; count: string }>(`
        SELECT mode, COUNT(*)::text as count
        FROM ranksheet.rank_sheets
        WHERE mode IS NOT NULL
        GROUP BY mode
      `),

      // Sheets average valid count
      pool.query<{ avg: string | null }>(`
        SELECT AVG(valid_count)::numeric(10,2)::text as avg
        FROM ranksheet.rank_sheets
      `),

      // Cache stats
      pool.query<{
        total: string
        valid: string
        stale: string
        error: string
        not_found: string
        expiring_soon: string
        expired: string
      }>(`
        SELECT
          COUNT(*)::text as total,
          COUNT(*) FILTER (WHERE status = 'VALID')::text as valid,
          COUNT(*) FILTER (WHERE status = 'STALE')::text as stale,
          COUNT(*) FILTER (WHERE status = 'ERROR')::text as error,
          COUNT(*) FILTER (WHERE status = 'NOT_FOUND')::text as not_found,
          COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at <= NOW() + interval '7 days' AND expires_at > NOW())::text as expiring_soon,
          COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at <= NOW())::text as expired
        FROM ranksheet.asin_cache
      `),

      // Job stats
      pool.query<{
        queued: string
        running: string
        completed_24h: string
        failed_24h: string
        avg_duration_ms: string | null
      }>(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'QUEUED')::text as queued,
          COUNT(*) FILTER (WHERE status = 'RUNNING')::text as running,
          COUNT(*) FILTER (WHERE status = 'SUCCESS' AND finished_at > NOW() - interval '24 hours')::text as completed_24h,
          COUNT(*) FILTER (WHERE status = 'FAILED' AND finished_at > NOW() - interval '24 hours')::text as failed_24h,
          AVG(duration_ms) FILTER (WHERE status IN ('SUCCESS', 'FAILED') AND finished_at > NOW() - interval '24 hours')::numeric(10,0)::text as avg_duration_ms
        FROM ranksheet.job_runs
      `),
    ])

    // Build response
    const stats: StatsResponse = {
      ok: true,
      timestamp: new Date().toISOString(),
      keywords: {
        total: keywordsTotal.totalDocs ?? 0,
        byStatus: Object.fromEntries(keywordsByStatus.rows.map((r) => [r.status, parseInt(r.count, 10)])),
        byCategory: Object.fromEntries(keywordsByCategory.rows.map((r) => [r.category, parseInt(r.count, 10)])),
        active: keywordsActive.totalDocs ?? 0,
        contentGenerated: keywordsContentGenerated.totalDocs ?? 0,
      },
      sheets: {
        total: sheetsTotal.totalDocs ?? 0,
        byReadiness: Object.fromEntries(sheetsByReadiness.rows.map((r) => [r.readiness_level, parseInt(r.count, 10)])),
        byMode: Object.fromEntries(sheetsByMode.rows.map((r) => [r.mode, parseInt(r.count, 10)])),
        avgValidCount: sheetsAvgValid.rows[0]?.avg ? parseFloat(sheetsAvgValid.rows[0].avg) : 0,
      },
      cache: {
        total: parseInt(cacheStats.rows[0]?.total ?? '0', 10),
        byStatus: {
          VALID: parseInt(cacheStats.rows[0]?.valid ?? '0', 10),
          STALE: parseInt(cacheStats.rows[0]?.stale ?? '0', 10),
          ERROR: parseInt(cacheStats.rows[0]?.error ?? '0', 10),
          NOT_FOUND: parseInt(cacheStats.rows[0]?.not_found ?? '0', 10),
        },
        expiringSoon: parseInt(cacheStats.rows[0]?.expiring_soon ?? '0', 10),
        expired: parseInt(cacheStats.rows[0]?.expired ?? '0', 10),
      },
      jobs: {
        queued: parseInt(jobStats.rows[0]?.queued ?? '0', 10),
        running: parseInt(jobStats.rows[0]?.running ?? '0', 10),
        completed24h: parseInt(jobStats.rows[0]?.completed_24h ?? '0', 10),
        failed24h: parseInt(jobStats.rows[0]?.failed_24h ?? '0', 10),
        avgDurationMs: jobStats.rows[0]?.avg_duration_ms ? parseInt(jobStats.rows[0].avg_duration_ms, 10) : null,
      },
      pool: getPoolStats(),
    }

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
