import { describe, expect, it } from 'vitest'

import { buildSheetTrends } from '@/lib/ranksheet/trends'

function makeSanitizedRow(args: {
  asin: string
  rank: number
  title?: string
  brand?: string
  score?: number
}): any {
  return {
    rank: args.rank,
    asin: args.asin,
    title: args.title ?? `Product ${args.asin}`,
    brand: args.brand ?? 'Acme',
    image: 'https://m.media-amazon.com/images/I/test.jpg',
    score: args.score ?? 80,
    marketShareIndex: 90,
    buyerTrustIndex: 70,
    trendDelta: 0,
    trendLabel: 'Stable',
    badges: [],
  }
}

describe('buildSheetTrends', () => {
  it('builds rank points across periods and uses latest top as the series set', () => {
    const older = {
      dataPeriod: '2025-12-01',
      updatedAt: new Date('2025-12-02T00:00:00Z'),
      readinessLevel: 'FULL' as const,
      validCount: 10,
      rows: [makeSanitizedRow({ asin: 'A2', rank: 1 }), makeSanitizedRow({ asin: 'A1', rank: 2 })],
    }

    const latest = {
      dataPeriod: '2025-12-08',
      updatedAt: new Date('2025-12-09T00:00:00Z'),
      readinessLevel: 'FULL' as const,
      validCount: 10,
      rows: [makeSanitizedRow({ asin: 'A1', rank: 1 }), makeSanitizedRow({ asin: 'A3', rank: 2 })],
    }

    const out = buildSheetTrends({ sheets: [latest, older], top: 2 })

    expect(out.periods.map((p) => p.dataPeriod)).toEqual(['2025-12-01', '2025-12-08'])
    expect(out.series.map((s) => s.asin)).toEqual(['A1', 'A3'])

    const a1 = out.series.find((s) => s.asin === 'A1')
    expect(a1?.points.map((p) => p.rank)).toEqual([2, 1])

    const a3 = out.series.find((s) => s.asin === 'A3')
    expect(a3?.points.map((p) => p.rank)).toEqual([null, 2])
  })

  it('returns empty output for empty sheets', () => {
    const out = buildSheetTrends({ sheets: [], top: 10 })
    expect(out.periods).toEqual([])
    expect(out.series).toEqual([])
  })
})
