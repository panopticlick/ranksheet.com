/**
 * POST /api/admin/retry-failed
 * 重试失败的关键词刷新任务
 * 需要 x-job-token 认证
 */

import { NextResponse } from 'next/server'

import { requireJobAuth } from '@/lib/auth/jobToken'
import { enforceRateLimit } from '@/lib/security/rateLimit'
import { withIdempotency } from '@/lib/security/idempotency'
import { retryFailedKeywords } from '@/lib/jobs/retryFailedKeywords'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  // 认证检查
  const unauthorized = requireJobAuth(request)
  if (unauthorized) return unauthorized

  // 速率限制
  const limited = await enforceRateLimit(request, {
    name: 'admin_retry_failed',
    limit: 5,
    windowSeconds: 60,
  })
  if (limited) return limited

  return await withIdempotency(request, async () => {
    try {
      // 解析请求参数
      const body = await request.json().catch(() => ({}))
      const limit = typeof body.limit === 'number' ? body.limit : 10
      const dryRun = body.dryRun === true
      const maxRetries = typeof body.maxRetries === 'number' ? body.maxRetries : 3

      logger.info('Starting retry failed keywords job', {
        limit,
        dryRun,
        maxRetries,
      })

      // 执行重试任务
      const result = await retryFailedKeywords({
        limit,
        dryRun,
        maxRetries,
      })

      logger.info('Retry failed keywords completed', result)

      return NextResponse.json({
        ok: true,
        result,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      logger.error('Retry failed keywords job failed', {
        error: error instanceof Error ? error.message : String(error),
      })

      return NextResponse.json(
        {
          ok: false,
          error: 'retry_failed',
          message: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      )
    }
  })
}
