import { logger } from '@/lib/logger'
import type { CandidateRow } from '@/lib/ranksheet/dedupe'

export type TrendLabel = 'Rising' | 'Falling' | 'Stable'

export type SanitizedRow = {
  rank: number
  asin: string
  title: string
  brand: string
  image: string
  score: number
  marketShareIndex: number
  buyerTrustIndex: number
  trendDelta: number
  trendLabel: TrendLabel
  badges: string[]
}

/**
 * Safe clamp function with NaN/Infinity protection
 */
function clamp(n: number, min: number, max: number): number {
  // Validate all inputs are finite numbers
  if (!Number.isFinite(n) || !Number.isFinite(min) || !Number.isFinite(max)) {
    logger.warn({ n, min, max }, 'clamp_received_non_finite_value')
    return min // Return minimum as safe fallback
  }
  return Math.max(min, Math.min(max, n))
}

/**
 * Safe round function with NaN/Infinity protection
 */
function roundInt(n: number): number {
  if (!Number.isFinite(n)) {
    logger.warn({ n }, 'roundInt_received_non_finite_value')
    return 0 // Return 0 as safe fallback
  }
  return Math.round(n)
}

/**
 * Safe division with zero-division protection
 */
function safeDivide(numerator: number, denominator: number, fallback: number = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    logger.warn({ numerator, denominator }, 'safeDivide_received_non_finite_value')
    return fallback
  }
  if (denominator === 0) {
    logger.warn({ numerator, denominator }, 'safeDivide_division_by_zero')
    return fallback
  }
  const result = numerator / denominator
  if (!Number.isFinite(result)) {
    logger.warn({ numerator, denominator, result }, 'safeDivide_produced_non_finite_result')
    return fallback
  }
  return result
}

export function computeSanitizedRows(args: {
  rows: CandidateRow[]
  prevRankByAsin: Map<string, number>
  multipleOptionsAsins: Set<string>
}): SanitizedRow[] {
  const input = args.rows.filter((r) => r.card?.title && r.card?.brand && r.card?.image)
  if (input.length === 0) return []

  // Find max click share with safety checks
  const validClickShares = input
    .map((r) => r.clickShare)
    .filter((cs) => Number.isFinite(cs) && cs > 0)
  const maxClick = validClickShares.length > 0 ? Math.max(...validClickShares) : 0.0001

  // Calculate trust ratios with safe division
  const trustRatios = input.map((r) => {
    const click = Number.isFinite(r.clickShare) && r.clickShare > 0 ? r.clickShare : 0.0001
    const conv = Number.isFinite(r.conversionShare) && r.conversionShare > 0 ? r.conversionShare : 0
    return clamp(safeDivide(conv, click, 0), 0, 2)
  })

  const minTrust = Math.min(...trustRatios)
  const maxTrust = Math.max(...trustRatios)

  const topN = input.length

  return input.map((r, idx) => {
    // Market share index with safe division
    const marketShareRaw = safeDivide(100 * r.clickShare, maxClick, 0)
    const marketShareIndex = clamp(roundInt(marketShareRaw), 0, 100)

    // Buyer trust index with safe division
    const trustRatio = trustRatios[idx] ?? 0
    const trustRange = maxTrust - minTrust
    const buyerTrustRaw = trustRange === 0 ? 50 : safeDivide(100 * (trustRatio - minTrust), trustRange, 50)
    const buyerTrustIndex = clamp(roundInt(buyerTrustRaw), 0, 100)

    // Trend calculations
    const prevRank = args.prevRankByAsin.get(r.asin)
    const trendDelta = prevRank && Number.isFinite(prevRank) ? prevRank - r.rank : 0
    const trendLabel: TrendLabel = trendDelta >= 3 ? 'Rising' : trendDelta <= -3 ? 'Falling' : 'Stable'
    const trendScore = clamp(50 + trendDelta * 5, 0, 100)

    // Rank score with safe division
    const rankScoreRaw = safeDivide(100 * (topN - r.rank + 1), topN, 0)
    const rankScore = clamp(roundInt(rankScoreRaw), 0, 100)

    // Popularity composite
    const popularity = 0.7 * marketShareIndex + 0.3 * rankScore

    // Final score composite
    const scoreRaw = 0.55 * popularity + 0.3 * buyerTrustIndex + 0.15 * trendScore
    const score = clamp(roundInt(scoreRaw), 1, 100)

    // Validate all computed metrics before returning
    const metrics = { marketShareIndex, buyerTrustIndex, score, trendDelta }
    for (const [key, value] of Object.entries(metrics)) {
      if (!Number.isFinite(value)) {
        logger.error(
          { asin: r.asin, key, value, clickShare: r.clickShare, conversionShare: r.conversionShare },
          'computed_metric_non_finite'
        )
      }
    }

    const badges: string[] = []
    if (r.rank === 1 && marketShareIndex >= 90) badges.push('👑 Category King')
    if (trendDelta >= 5) badges.push('📈 Trending')
    if (buyerTrustIndex >= 85 && marketShareIndex <= 60) badges.push('🧲 High Intent')
    if (args.multipleOptionsAsins.has(r.asin)) badges.push('🎨 Multiple Options')

    return {
      rank: r.rank,
      asin: r.asin,
      title: r.card!.title!,
      brand: r.card!.brand!,
      image: r.card!.image!,
      score,
      marketShareIndex,
      buyerTrustIndex,
      trendDelta,
      trendLabel,
      badges,
    }
  })
}

