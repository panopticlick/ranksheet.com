import { getKeywordAsins, getWeeklyReportDates } from '@/lib/amzapi/fastapi'
import { getProductsByAsins, warmPaapi5 } from '@/lib/amzapi/express'
import { getPayloadClient } from '@/lib/payload/client'
import { getAsinCache, upsertAsinCache } from '@/lib/ranksheet/asinCache'
import { dedupeVariations, type CandidateRow } from '@/lib/ranksheet/dedupe'
import { extractProductCard, ProductCardSchema } from '@/lib/ranksheet/productCard'
import { computeReadiness } from '@/lib/ranksheet/readiness'
import { computeSanitizedRows, type SanitizedRow } from '@/lib/ranksheet/scoring'
import { logger } from '@/lib/logger'
import { withAdvisoryLock } from '@/lib/db/locks'
import { env } from '@/lib/env'
import type { Keyword, RankSheet } from '@/payload-types'
import type { ExpressProduct } from '@/lib/amzapi/express'

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isoDateToUtcMidnight(date: string): string {
  return `${date}T00:00:00.000Z`
}

export type RefreshKeywordResult =
  | {
      ok: true
      slug: string
      keyword: string
      dataPeriod: string
      mode: 'NORMAL' | 'LOW_DATA'
      readinessLevel: 'FULL' | 'PARTIAL' | 'LOW' | 'CRITICAL'
      validCount: number
      updated: boolean
      stats: Record<string, unknown>
    }
  | {
      ok: false
      slug: string
      error: string
      detail?: string
    }

export async function refreshKeywordBySlug(args: { slug: string; reportDate?: string; dryRun?: boolean }): Promise<RefreshKeywordResult> {
  const slug = args.slug.trim()
  const dryRun = args.dryRun === true

  // Acquire distributed lock to prevent concurrent refreshes of the same keyword
  const lockKey = `refresh:keyword:${slug}`
  const lockResult = await withAdvisoryLock(lockKey, async () => {
    return await _refreshKeywordBySlugImpl({ slug, reportDate: args.reportDate, dryRun })
  })

  if (!lockResult.acquired) {
    logger.warn({ slug }, 'refresh_lock_not_acquired')
    return { ok: false, slug, error: 'refresh_in_progress' }
  }

  return lockResult.result!
}

async function _refreshKeywordBySlugImpl(args: { slug: string; reportDate?: string; dryRun: boolean }): Promise<RefreshKeywordResult> {
  const { slug, dryRun } = args

  const payload = await getPayloadClient()

  const keywordRes = await payload.find({
    collection: 'keywords',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })

  const keywordDoc = keywordRes.docs[0] as Keyword | undefined
  if (!keywordDoc) return { ok: false, slug, error: 'keyword_not_found' }

  if (!keywordDoc.isActive || keywordDoc.status === 'PAUSED') {
    return { ok: false, slug, error: 'keyword_inactive' }
  }

  try {
    const topN = clampInt(Number(keywordDoc.topN ?? 20), 5, 50)
    const buffer = clampInt(topN, 10, 40)
    const limit = topN + buffer

    const reportDates = await getWeeklyReportDates({ limit: 2 })
    const currentReportDate = args.reportDate ?? reportDates[0]
    const prevReportDate = reportDates[1]

    if (!currentReportDate) return { ok: false, slug, error: 'no_report_date' }

    const [currentItems, prevItems] = await Promise.all([
      getKeywordAsins({ keyword: keywordDoc.keyword, reportDate: currentReportDate, limit }),
      prevReportDate
        ? getKeywordAsins({ keyword: keywordDoc.keyword, reportDate: prevReportDate, limit })
        : Promise.resolve([]),
    ])

    currentItems.sort((a, b) => a.top3_rank - b.top3_rank)
    const prevRankByAsin = new Map(prevItems.map((i) => [i.asin, i.top3_rank]))

    const asins = currentItems.map((i) => i.asin)

    // Step 1: Check ASIN cache first (reduce Express API calls by 90%+)
    // This includes both EXISTS and NOT_FOUND entries (negative caching)
    const cachedProducts = await getAsinCache(asins)

    // Filter out NOT_FOUND from cache (no need to re-fetch)
    // Only fetch ASINs that are: (1) not in cache, OR (2) cached as NOT_FOUND (skip those entirely)
    const missingAsins = asins.filter((asin) => {
      const cached = cachedProducts.get(asin)
      // If not in cache, it's missing
      if (!cached) return true
      // If cached as NOT_FOUND, skip (don't re-fetch invalid ASINs)
      if (cached.status === 'NOT_FOUND') return false
      // If cached as EXISTS, no need to fetch
      return false
    })

    logger.debug({
      totalAsins: asins.length,
      cachedHits: cachedProducts.size,
      cachedExists: Array.from(cachedProducts.values()).filter((c) => c.status === 'EXISTS').length,
      cachedNotFound: Array.from(cachedProducts.values()).filter((c) => c.status === 'NOT_FOUND').length,
      missingAsins: missingAsins.length,
    }, 'ASIN cache lookup for keyword refresh (with negative caching)')

    // Step 2: Fetch missing ASINs from Express API
    const freshProducts = missingAsins.length > 0
      ? await getProductsByAsins(missingAsins)
      : new Map<string, ExpressProduct>()

    // Step 3: Merge cached and fresh products with validation
    const products = new Map<string, ExpressProduct>()
    let cachedCorruptedCount = 0

    // Add cached products with schema validation (skip NOT_FOUND entries)
    for (const [asin, cached] of cachedProducts) {
      // Skip negative cache entries (NOT_FOUND)
      if (cached.status === 'NOT_FOUND') {
        logger.debug({ asin }, 'Skipping NOT_FOUND ASIN from negative cache')
        continue
      }

      // Reconstruct ProductCard for validation
      const reconstructed = {
        asin: cached.asin,
        title: cached.title ?? null,
        brand: cached.brand ?? null,
        image: cached.imageUrl ?? null,
        parentAsin: cached.parentAsin ?? null,
        variationGroup: null, // Not stored in cache currently
      }

      // Validate cached data integrity
      const validationResult = ProductCardSchema.safeParse(reconstructed)
      if (!validationResult.success) {
        logger.warn(
          {
            asin,
            errors: validationResult.error.issues,
            cached: reconstructed,
          },
          'cached_product_validation_failed'
        )
        cachedCorruptedCount++
        continue // Skip corrupted cache entry
      }

      products.set(asin, {
        asin: cached.asin,
        title: cached.title ?? undefined,
        featuredImage: cached.imageUrl ?? undefined,
        parentAsin: cached.parentAsin ?? undefined,
        brand: cached.brand ? { name: cached.brand } : undefined,
      })
    }

    if (cachedCorruptedCount > 0) {
      logger.warn(
        { slug, cachedCorruptedCount, totalCached: cachedProducts.size },
        'skipped_corrupted_cache_entries'
      )
    }

    // Add fresh products (overwrite cached if exists)
    for (const [asin, product] of freshProducts) {
      products.set(asin, product)
    }

    // Step 4: Update cache with fresh products (including negative caching for NOT_FOUND)
    if (missingAsins.length > 0) {
      const cacheEntries = missingAsins.map((asin) => {
        const product = freshProducts.get(asin)

        // If product not found in Express API response, cache as NOT_FOUND
        if (!product) {
          return {
            asin,
            status: 'NOT_FOUND' as const,
            ttlDays: 7, // Shorter TTL for negative cache
          }
        }

        // Otherwise, cache as EXISTS with product data
        const card = extractProductCard(product)
        return {
          asin: product.asin,
          status: 'EXISTS' as const,
          title: card.title ?? undefined,
          brand: card.brand ?? undefined,
          imageUrl: card.image ?? undefined,
          parentAsin: card.parentAsin ?? undefined,
          ttlDays: 30, // Cache stable fields for 30 days
        }
      })

      await upsertAsinCache(cacheEntries).catch((err) => {
        logger.warn({ err }, 'Failed to update ASIN cache')
      })

      // Log negative cache entries for monitoring
      const notFoundCount = cacheEntries.filter((e) => e.status === 'NOT_FOUND').length
      if (notFoundCount > 0) {
        logger.info(
          { slug, notFoundCount, totalFetched: missingAsins.length },
          'Cached NOT_FOUND ASINs (negative caching)'
        )
      }
    }

    const rows: CandidateRow[] = currentItems.map((i) => {
      const product = products.get(i.asin)
      const card = product ? extractProductCard(product) : null
      return {
        rank: i.top3_rank,
        asin: i.asin,
        clickShare: i.click_share,
        conversionShare: i.conversion_share,
        card,
      }
    })

    let readiness = computeReadiness(rows, 10)
    let warmupJobIds: string[] = []

    if (readiness.missingAsins.length > 0) {
      try {
        const { jobIds } = await warmPaapi5(readiness.missingAsins.slice(0, 20))
        warmupJobIds = jobIds
        await sleep(750)

        const warmed = await getProductsByAsins(readiness.missingAsins)

        // Cache warmed products (same 30-day TTL as main fetch)
        if (warmed.size > 0) {
          const warmedCacheEntries = Array.from(warmed.values()).map((p) => {
            const card = extractProductCard(p)
            return {
              asin: p.asin,
              title: card.title ?? undefined,
              brand: card.brand ?? undefined,
              imageUrl: card.image ?? undefined,
              parentAsin: card.parentAsin ?? undefined,
              ttlDays: 30,
            }
          })

          await upsertAsinCache(warmedCacheEntries).catch((err) => {
            logger.warn({ err }, 'Failed to cache warmed products')
          })
        }

        for (const row of rows) {
          if (!readiness.missingAsins.includes(row.asin)) continue
          const product = warmed.get(row.asin) ?? products.get(row.asin)
          row.card = product ? extractProductCard(product) : row.card
        }
        readiness = computeReadiness(rows, 10)
      } catch (err) {
        logger.warn({ err }, 'warmup_failed')
      }
    }

    const deduped = dedupeVariations(rows)
    const multipleOptionsAsins = new Set<string>()
    for (const row of deduped.kept) {
      const key = deduped.groupKeyByAsin.get(row.asin)
      if (!key) continue
      if ((deduped.groupCountByKey.get(key) ?? 0) > 1) {
        multipleOptionsAsins.add(row.asin)
      }
    }

    const finalCandidates: CandidateRow[] = []
    for (const row of deduped.kept) {
      if (!row.card?.title || !row.card?.brand || !row.card?.image) continue
      finalCandidates.push(row)
      if (finalCandidates.length >= topN) break
    }

    const sanitized: SanitizedRow[] = computeSanitizedRows({
      rows: finalCandidates,
      prevRankByAsin,
      multipleOptionsAsins,
    })

    const validCount = sanitized.length
    const mode: 'NORMAL' | 'LOW_DATA' = validCount < 5 ? 'LOW_DATA' : 'NORMAL'

    const readyToPublish = readiness.level === 'FULL' || readiness.level === 'PARTIAL'
    const indexable = readyToPublish && validCount >= 3

    const status = indexable ? 'ACTIVE' : 'WARMING_UP'
    const statusReason = !readyToPublish
      ? `Readiness=${readiness.level} (${readiness.ready}/${readiness.total} with image+title).`
      : validCount < 3
        ? `Low data (${validCount} valid items).`
        : ''

    const nowIso = new Date().toISOString()

    type StatsValue = string | number | boolean | Record<string, unknown> | unknown[] | undefined

    const stats: Record<string, StatsValue> = {
      topN,
      buffer,
      fetchedCount: rows.length,
      dedupedRemoved: deduped.removed.length,
      validCount,
      readiness,
      warmupJobs: warmupJobIds.length,
      reportDate: currentReportDate,
      prevReportDate: prevReportDate ?? undefined,
    }

    if (!dryRun) {
      // Atomic update pattern: Track both operations and implement compensation on failure
      // Since Payload CMS uses separate connections, we cannot use database transactions
      // Instead, we use sequential updates with rollback on failure

      let keywordUpdated = false
      let rankSheetUpdated = false
      const originalKeywordState = {
        status: keywordDoc.status,
        statusReason: keywordDoc.statusReason,
        indexable: keywordDoc.indexable,
        lastRefreshedAt: keywordDoc.lastRefreshedAt,
      }

      try {
        // Step 1: Update keyword status
        await payload.update({
          collection: 'keywords',
          id: keywordDoc.id,
          data: {
            status,
            statusReason: statusReason || undefined,
            indexable,
            lastRefreshedAt: nowIso,
          },
          overrideAccess: true,
        })
        keywordUpdated = true
        logger.debug({ slug, status }, 'keyword_status_updated')

        // Step 2: Create/update rank sheet if ready
        if (readyToPublish && validCount >= 3) {
          const existing = await payload.find({
            collection: 'rank-sheets',
            where: {
              and: [{ keyword: { equals: keywordDoc.id } }, { dataPeriod: { equals: currentReportDate } }],
            },
            limit: 1,
            overrideAccess: true,
            depth: 0,
          })
          const existingDoc = (existing.docs[0] as RankSheet | undefined) ?? undefined

          const historyRes = await payload.find({
            collection: 'rank-sheets',
            where: { keyword: { equals: keywordDoc.id } },
            sort: '-dataPeriod',
            limit: 4,
            overrideAccess: true,
            depth: 0,
          })

          const history = (historyRes.docs as RankSheet[]).map((d) => ({
            dataPeriod: d.dataPeriod,
            updatedAt: d.updatedAt,
            validCount: d.validCount,
            readinessLevel: d.readinessLevel,
          }))

          const data = {
            keyword: keywordDoc.id,
            dataPeriod: currentReportDate,
            reportDate: isoDateToUtcMidnight(currentReportDate),
            mode,
            validCount,
            readinessLevel: readiness.level,
            rows: sanitized,
            history,
            metadata: stats,
          }

          if (existingDoc) {
            await payload.update({
              collection: 'rank-sheets',
              id: existingDoc.id,
              data,
              overrideAccess: true,
            })
            logger.debug({ slug, rankSheetId: existingDoc.id }, 'rank_sheet_updated')
          } else {
            await payload.create({
              collection: 'rank-sheets',
              data,
              overrideAccess: true,
            })
            logger.debug({ slug }, 'rank_sheet_created')
          }
          rankSheetUpdated = true
        }
      } catch (err) {
        // Compensating transaction: Rollback keyword update if rank-sheet update failed
        logger.error({ err, keywordUpdated, rankSheetUpdated, slug }, 'refresh_persist_failed')

        if (keywordUpdated && !rankSheetUpdated && readyToPublish && validCount >= 3) {
          // Rank sheet update failed after keyword was updated - revert keyword
          logger.warn({ slug }, 'reverting_keyword_update_due_to_ranksheet_failure')
          try {
            await payload.update({
              collection: 'keywords',
              id: keywordDoc.id,
              data: originalKeywordState,
              overrideAccess: true,
            })
          } catch (rollbackErr) {
            logger.error({ rollbackErr, slug }, 'keyword_rollback_failed_manual_intervention_required')
          }
        }
        throw err
      }
    }

    return {
      ok: true,
      slug,
      keyword: keywordDoc.keyword,
      dataPeriod: currentReportDate,
      mode,
      readinessLevel: readiness.level,
      validCount,
      updated: !dryRun && readyToPublish && validCount >= 3,
      stats,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    logger.error({ err, slug }, 'refresh_keyword_failed')

    if (!dryRun) {
      await payload
        .update({
          collection: 'keywords',
          id: keywordDoc.id,
          data: {
            status: 'ERROR',
            statusReason: message,
            indexable: false,
            lastRefreshedAt: new Date().toISOString(),
          },
          overrideAccess: true,
        })
        .catch((updateErr) => logger.error({ updateErr }, 'keyword_error_status_update_failed'))
    }

    // Only expose error details in development mode
    const response: RefreshKeywordResult = { ok: false, slug, error: 'refresh_failed' }
    if (env.NODE_ENV === 'development') {
      response.detail = message
    }
    return response
  }
}
