import { getPayloadClient } from '@/lib/payload/client'
import { refreshKeywordBySlug } from '@/lib/ranksheet/refreshKeyword'
import { logger } from '@/lib/logger'
import type { Keyword } from '@/payload-types'

export interface RetryFailedKeywordsResult {
  attempted: number
  succeeded: number
  failed: number
  skipped: number
}

/**
 * Retry failed keyword refreshes
 *
 * This job finds keywords with status='ERROR' and attempts to refresh them again.
 * Useful for recovering from transient API failures.
 */
export async function retryFailedKeywords(options: {
  limit?: number
  dryRun?: boolean
  maxRetries?: number
} = {}): Promise<RetryFailedKeywordsResult> {
  const { limit = 10, dryRun = false, maxRetries = 3 } = options

  const payload = await getPayloadClient()

  const result: RetryFailedKeywordsResult = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  }

  try {
    // Find ERROR keywords that haven't exceeded max retries
    const errorKeywords = await payload.find({
      collection: 'keywords',
      where: {
        and: [
          { status: { equals: 'ERROR' } },
          { isActive: { equals: true } },
        ],
      },
      limit,
      sort: '-lastRefreshedAt',
      overrideAccess: true,
    })

    logger.info({ count: errorKeywords.docs.length }, 'retry_failed_keywords_started')

    for (const keywordDoc of errorKeywords.docs) {
      const keyword = keywordDoc as Keyword

      // Check retry count from metadata
      const errorCount = (keyword.refreshMetadata as any)?.errorCount ?? 0
      if (errorCount >= maxRetries) {
        result.skipped++
        logger.warn({ slug: keyword.slug, errorCount }, 'retry_skipped_max_retries')
        continue
      }

      if (dryRun) {
        result.attempted++
        continue
      }

      result.attempted++

      try {
        // Attempt refresh
        const refreshResult = await refreshKeywordBySlug({
          slug: keyword.slug,
          dryRun: false,
        })

        if (refreshResult.ok) {
          result.succeeded++

          // Update keyword status back to ACTIVE
          await payload.update({
            collection: 'keywords',
            id: keyword.id,
            data: {
              status: 'ACTIVE',
              statusReason: null,
            },
            overrideAccess: true,
          })

          logger.info({ slug: keyword.slug }, 'retry_keyword_succeeded')
        } else {
          result.failed++
          logger.warn(
            { slug: keyword.slug, error: refreshResult.error },
            'retry_keyword_failed',
          )
        }
      } catch (error) {
        result.failed++
        logger.error({ error, slug: keyword.slug }, 'retry_keyword_exception')
      }

      // Rate limiting: wait 1s between retries
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    logger.info(result, 'retry_failed_keywords_completed')

    return result
  } catch (error) {
    logger.error({ error }, 'retry_failed_keywords_job_failed')
    throw error
  }
}
