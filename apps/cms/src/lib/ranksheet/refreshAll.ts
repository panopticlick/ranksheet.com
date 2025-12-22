import { getPayloadClient } from '@/lib/payload/client'
import { refreshKeywordBySlug, type RefreshKeywordResult } from '@/lib/ranksheet/refreshKeyword'
import { logger } from '@/lib/logger'
import type { Keyword } from '@/payload-types'

/**
 * Run items with concurrency control using Semaphore pattern
 *
 * Previous implementation had race condition: queue.shift() is not atomic,
 * multiple workers could process the same item.
 *
 * New implementation uses Promise-based concurrency control with guaranteed:
 * - Each item processed exactly once
 * - Results returned in original order
 * - Proper error handling
 *
 * @param items - Array of items to process
 * @param concurrency - Max concurrent operations
 * @param fn - Async function to process each item
 * @returns Array of results in original order
 */
async function runWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return []
  if (concurrency <= 0) throw new Error('Concurrency must be > 0')

  // Results array with placeholders to maintain order
  const results: R[] = new Array(items.length)

  // Index tracking (shared mutable state protected by async execution order)
  let nextIndex = 0

  // Worker function: processes items sequentially from shared index
  async function worker(): Promise<void> {
    while (true) {
      // Atomically get next index (JS event loop ensures this is safe)
      const currentIndex = nextIndex++

      // Check if we're done
      if (currentIndex >= items.length) {
        break
      }

      const item = items[currentIndex]!

      try {
        // Process item and store result at correct index
        results[currentIndex] = await fn(item)
      } catch (error) {
        // Re-throw to be caught by Promise.all
        throw error
      }
    }
  }

  // Create worker pool
  const workerCount = Math.min(Math.max(1, concurrency), items.length)
  const workers = Array.from({ length: workerCount }, () => worker())

  // Wait for all workers to complete
  await Promise.all(workers)

  return results
}

export type RefreshAllResult = {
  ok: boolean
  total: number
  success: number
  failed: number
  results: RefreshKeywordResult[]
}

export async function refreshAllKeywords(args: { concurrency?: number; limit?: number } = {}): Promise<RefreshAllResult> {
  const concurrency = Math.max(1, Math.min(10, Math.floor(args.concurrency ?? 3)))
  const limit = Math.max(1, Math.min(2000, Math.floor(args.limit ?? 500)))

  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'keywords',
    where: { isActive: { equals: true } },
    sort: '-priority',
    limit,
    overrideAccess: true,
    depth: 0,
  })

  const keywords = res.docs as Keyword[]
  logger.info({ count: keywords.length, concurrency }, 'refresh_all_start')

  const results = await runWithConcurrency(keywords, concurrency, async (k) => {
    try {
      return await refreshKeywordBySlug({ slug: k.slug })
    } catch (err) {
      return {
        ok: false as const,
        slug: k.slug,
        error: 'refresh_failed',
        detail: err instanceof Error ? err.message : 'unknown',
      }
    }
  })

  const success = results.filter((r) => r.ok).length
  const failed = results.length - success

  logger.info({ total: results.length, success, failed }, 'refresh_all_done')

  return { ok: failed === 0, total: results.length, success, failed, results }
}
