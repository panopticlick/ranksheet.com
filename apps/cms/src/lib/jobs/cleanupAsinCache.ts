import { getPayloadClient } from '@/lib/payload/client'
import { logger } from '@/lib/logger'

export interface CleanupAsinCacheResult {
  deletedCount: number
  totalChecked: number
  errors: number
}

/**
 * Cleanup expired ASIN cache entries
 *
 * This job should run periodically (e.g., daily via cron) to remove:
 * - Entries older than expiresAt timestamp
 * - Entries with status = 'ERROR' older than 7 days
 * - Orphaned entries (no longer referenced by any rank sheets)
 */
export async function cleanupAsinCache(options: {
  dryRun?: boolean
  batchSize?: number
} = {}): Promise<CleanupAsinCacheResult> {
  const { dryRun = false, batchSize = 100 } = options

  const payload = await getPayloadClient()

  const result: CleanupAsinCacheResult = {
    deletedCount: 0,
    totalChecked: 0,
    errors: 0,
  }

  try {
    // 1. Find expired entries
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const expiredRes = await payload.find({
      collection: 'asin-cache',
      where: {
        or: [
          {
            expiresAt: {
              less_than: now.toISOString(),
            },
          },
          {
            and: [
              {
                status: {
                  equals: 'ERROR',
                },
              },
              {
                fetchedAt: {
                  less_than: sevenDaysAgo.toISOString(),
                },
              },
            ],
          },
        ],
      },
      limit: batchSize,
      overrideAccess: true,
    })

    result.totalChecked = expiredRes.docs.length

    if (dryRun) {
      logger.info({ count: result.totalChecked }, 'cleanup_asin_cache_dry_run')
      return result
    }

    // 2. Delete expired entries
    for (const doc of expiredRes.docs) {
      try {
        await payload.delete({
          collection: 'asin-cache',
          id: doc.id,
          overrideAccess: true,
        })
        result.deletedCount++
      } catch (error) {
        logger.error({ error, asin: doc.asin }, 'cleanup_asin_cache_delete_failed')
        result.errors++
      }
    }

    logger.info(
      {
        deletedCount: result.deletedCount,
        totalChecked: result.totalChecked,
        errors: result.errors,
      },
      'cleanup_asin_cache_completed',
    )

    return result
  } catch (error) {
    logger.error({ error }, 'cleanup_asin_cache_failed')
    throw error
  }
}
