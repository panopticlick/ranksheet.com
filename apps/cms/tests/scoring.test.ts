import { describe, expect, it } from 'vitest'

import type { CandidateRow } from '@/lib/ranksheet/dedupe'
import { computeSanitizedRows } from '@/lib/ranksheet/scoring'

function makeRow(args: {
  asin: string
  rank: number
  clickShare: number
  conversionShare: number
  title: string
  brand: string
}): CandidateRow {
  return {
    asin: args.asin,
    rank: args.rank,
    clickShare: args.clickShare,
    conversionShare: args.conversionShare,
    card: {
      title: args.title,
      brand: args.brand,
      image: 'https://m.media-amazon.com/images/I/test.jpg',
      parentAsin: null,
      variationGroup: null,
    } as any,
  }
}

describe('computeSanitizedRows', () => {
  it('produces normalized indices within expected bounds', () => {
    const rows: CandidateRow[] = [
      makeRow({ asin: 'A1', rank: 1, clickShare: 0.08, conversionShare: 0.05, title: 'P1', brand: 'Acme' }),
      makeRow({ asin: 'A2', rank: 2, clickShare: 0.04, conversionShare: 0.02, title: 'P2', brand: 'Acme' }),
      makeRow({ asin: 'A3', rank: 3, clickShare: 0.02, conversionShare: 0.01, title: 'P3', brand: 'Acme' }),
    ]

    const prevRankByAsin = new Map<string, number>([
      ['A1', 2],
      ['A2', 1],
    ])
    const multipleOptionsAsins = new Set<string>(['A2'])

    const out = computeSanitizedRows({ rows, prevRankByAsin, multipleOptionsAsins })
    expect(out).toHaveLength(3)

    for (const r of out) {
      expect(r.score).toBeGreaterThanOrEqual(1)
      expect(r.score).toBeLessThanOrEqual(100)
      expect(r.marketShareIndex).toBeGreaterThanOrEqual(0)
      expect(r.marketShareIndex).toBeLessThanOrEqual(100)
      expect(r.buyerTrustIndex).toBeGreaterThanOrEqual(0)
      expect(r.buyerTrustIndex).toBeLessThanOrEqual(100)
      expect(['Rising', 'Falling', 'Stable']).toContain(r.trendLabel)
      expect(Array.isArray(r.badges)).toBe(true)
    }

    const top = out.find((r) => r.asin === 'A1')
    expect(top?.marketShareIndex).toBe(100)
    expect(top?.trendDelta).toBe(1)

    const a2 = out.find((r) => r.asin === 'A2')
    expect(a2?.badges.some((b) => b.includes('Multiple'))).toBe(true)
    expect(a2?.trendDelta).toBe(-1)
  })
})

