/**
 * POST /api/admin/cleanup-cache
 * 清理过期的ASIN缓存
 * 需要 x-job-token 认证
 */

import { NextResponse } from 'next/server'

import { requireJobAuth } from '@/lib/auth/jobToken'
import { enforceRateLimit } from '@/lib/security/rateLimit'
import { withIdempotency } from '@/lib/security/idempotency'
import { cleanupAsinCache } from '@/lib/jobs/cleanupAsinCache'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  // 认证检查
  const unauthorized = requireJobAuth(request)
  if (unauthorized) return unauthorized

  // 速率限制
  const limited = await enforceRateLimit(request, {
    name: 'admin_cleanup_cache',
    limit: 5,
    windowSeconds: 60,
  })
  if (limited) return limited

  return await withIdempotency(request, async () => {
    try {
      // 解析请求参数
      const body = await request.json().catch(() => ({}))
      const dryRun = body.dryRun === true
      const batchSize = typeof body.batchSize === 'number' ? body.batchSize : 100

      logger.info('Starting cache cleanup job', { dryRun, batchSize })

      // 执行清理任务
      const result = await cleanupAsinCache({
        dryRun,
        batchSize,
      })

      logger.info('Cache cleanup completed', result)

      return NextResponse.json({
        ok: true,
        result,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      logger.error('Cache cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
      })

      return NextResponse.json(
        {
          ok: false,
          error: 'cleanup_failed',
          message: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      )
    }
  })
}
