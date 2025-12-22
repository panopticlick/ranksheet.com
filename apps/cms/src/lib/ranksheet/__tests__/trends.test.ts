import { describe, it, expect } from 'vitest'
import { buildSheetTrends } from '../trends'

describe('buildSheetTrends', () => {
  const mockSanitizedRow = (rank: number, asin: string, score: number) => ({
    rank,
    asin,
    title: `Product ${asin}`,
    brand: `Brand ${asin}`,
    image: `https://example.com/${asin}.jpg`,
    score,
    marketShareIndex: score,
    buyerTrustIndex: score,
    trendDelta: 0,
    trendLabel: 'Stable' as const,
    badges: [],
  })

  it('should return empty result when no sheets provided', () => {
    const result = buildSheetTrends({ sheets: [], top: 10 })

    expect(result.periods).toEqual([])
    expect(result.series).toEqual([])
  })

  it('should build trends from single sheet', () => {
    const sheets = [
      {
        dataPeriod: '2024-12',
        updatedAt: new Date('2024-12-18T00:00:00Z'),
        readinessLevel: 'FULL' as const,
        validCount: 5,
        rows: [
          mockSanitizedRow(1, 'ASIN1', 95),
          mockSanitizedRow(2, 'ASIN2', 85),
          mockSanitizedRow(3, 'ASIN3', 75),
        ],
      },
    ]

    const result = buildSheetTrends({ sheets, top: 3 })

    expect(result.periods).toEqual([
      {
        dataPeriod: '2024-12',
        updatedAt: '2024-12-18T00:00:00.000Z',
        readinessLevel: 'FULL',
        validCount: 5,
      },
    ])

    expect(result.series).toHaveLength(3)
    expect(result.series[0]).toMatchObject({
      asin: 'ASIN1',
      title: 'Product ASIN1',
      brand: 'Brand ASIN1',
      image: 'https://example.com/ASIN1.jpg',
      points: [{ dataPeriod: '2024-12', rank: 1, score: 95 }],
    })
  })

  it('should build trends from multiple sheets', () => {
    const sheets = [
      {
        dataPeriod: '2024-12',
        updatedAt: new Date('2024-12-18T00:00:00Z'),
        readinessLevel: 'FULL' as const,
        validCount: 3,
        rows: [
          mockSanitizedRow(1, 'ASIN1', 95),
          mockSanitizedRow(2, 'ASIN2', 85),
          mockSanitizedRow(3, 'ASIN3', 75),
        ],
      },
      {
        dataPeriod: '2024-11',
        updatedAt: new Date('2024-11-18T00:00:00Z'),
        readinessLevel: 'FULL' as const,
        validCount: 3,
        rows: [
          mockSanitizedRow(1, 'ASIN2', 90), // ASIN2 was #1 in Nov
          mockSanitizedRow(2, 'ASIN1', 80), // ASIN1 was #2 in Nov
          mockSanitizedRow(3, 'ASIN3', 70),
        ],
      },
    ]

    const result = buildSheetTrends({ sheets, top: 3 })

    // Periods should be in chronological order (reversed)
    expect(result.periods).toEqual([
      {
        dataPeriod: '2024-11',
        updatedAt: '2024-11-18T00:00:00.000Z',
        readinessLevel: 'FULL',
        validCount: 3,
      },
      {
        dataPeriod: '2024-12',
        updatedAt: '2024-12-18T00:00:00.000Z',
        readinessLevel: 'FULL',
        validCount: 3,
      },
    ])

    expect(result.series).toHaveLength(3)

    // ASIN1: rank 2 → 1 (improved)
    const asin1Series = result.series.find((s) => s.asin === 'ASIN1')
    expect(asin1Series?.points).toEqual([
      { dataPeriod: '2024-11', rank: 2, score: 80 },
      { dataPeriod: '2024-12', rank: 1, score: 95 },
    ])

    // ASIN2: rank 1 → 2 (declined)
    const asin2Series = result.series.find((s) => s.asin === 'ASIN2')
    expect(asin2Series?.points).toEqual([
      { dataPeriod: '2024-11', rank: 1, score: 90 },
      { dataPeriod: '2024-12', rank: 2, score: 85 },
    ])
  })

  it('should handle ASINs that appear in some periods but not others', () => {
    const sheets = [
      {
        dataPeriod: '2024-12',
        updatedAt: new Date('2024-12-18T00:00:00Z'),
        readinessLevel: 'FULL' as const,
        validCount: 2,
        rows: [
          mockSanitizedRow(1, 'ASIN1', 95),
          mockSanitizedRow(2, 'ASIN2', 85),
        ],
      },
      {
        dataPeriod: '2024-11',
        updatedAt: new Date('2024-11-18T00:00:00Z'),
        readinessLevel: 'FULL' as const,
        validCount: 2,
        rows: [
          mockSanitizedRow(1, 'ASIN1', 90),
          mockSanitizedRow(2, 'ASIN3', 80), // Different ASIN
        ],
      },
    ]

    const result = buildSheetTrends({ sheets, top: 3 })

    // Should include ASINs from the latest period
    expect(result.series).toHaveLength(2)

    // ASIN1 appears in both periods
    const asin1Series = result.series.find((s) => s.asin === 'ASIN1')
    expect(asin1Series?.points).toHaveLength(2)
    expect(asin1Series?.points).toEqual([
      { dataPeriod: '2024-11', rank: 1, score: 90 },
      { dataPeriod: '2024-12', rank: 1, score: 95 },
    ])

    // ASIN2 only appears in Dec
    const asin2Series = result.series.find((s) => s.asin === 'ASIN2')
    expect(asin2Series?.points).toHaveLength(2)
    expect(asin2Series?.points).toEqual([
      { dataPeriod: '2024-11', rank: null, score: null }, // Missing in Nov
      { dataPeriod: '2024-12', rank: 2, score: 85 },
    ])
  })

  it('should respect top parameter and limit to specified number', () => {
    const sheets = [
      {
        dataPeriod: '2024-12',
        updatedAt: new Date('2024-12-18T00:00:00Z'),
        readinessLevel: 'FULL' as const,
        validCount: 10,
        rows: Array.from({ length: 10 }, (_, i) => mockSanitizedRow(i + 1, `ASIN${i + 1}`, 100 - i * 5)),
      },
    ]

    const result = buildSheetTrends({ sheets, top: 3 })

    // Should only include top 3 ASINs
    expect(result.series).toHaveLength(3)
    expect(result.series.map((s) => s.asin)).toEqual(['ASIN1', 'ASIN2', 'ASIN3'])
  })

  it('should cap top at 20 even if higher value specified', () => {
    const sheets = [
      {
        dataPeriod: '2024-12',
        updatedAt: new Date('2024-12-18T00:00:00Z'),
        readinessLevel: 'FULL' as const,
        validCount: 30,
        rows: Array.from({ length: 30 }, (_, i) => mockSanitizedRow(i + 1, `ASIN${i + 1}`, 100 - i)),
      },
    ]

    const result = buildSheetTrends({ sheets, top: 100 })

    // Should cap at 20
    expect(result.series.length).toBeLessThanOrEqual(20)
  })

  it('should handle sheets with invalid rows data', () => {
    const sheets = [
      {
        dataPeriod: '2024-12',
        updatedAt: new Date('2024-12-18T00:00:00Z'),
        readinessLevel: 'FULL' as const,
        validCount: 3,
        rows: [
          mockSanitizedRow(1, 'ASIN1', 95),
          { invalid: 'data' }, // Invalid row
          mockSanitizedRow(3, 'ASIN3', 75),
        ],
      },
    ]

    const result = buildSheetTrends({ sheets, top: 3 })

    // Should only include valid rows
    expect(result.series).toHaveLength(2)
    expect(result.series.map((s) => s.asin)).toEqual(['ASIN1', 'ASIN3'])
  })

  it('should handle sheets with null rows', () => {
    const sheets = [
      {
        dataPeriod: '2024-12',
        updatedAt: new Date('2024-12-18T00:00:00Z'),
        readinessLevel: 'CRITICAL' as const,
        validCount: 0,
        rows: null,
      },
    ]

    const result = buildSheetTrends({ sheets, top: 10 })

    expect(result.periods).toHaveLength(1)
    expect(result.series).toEqual([])
  })

  it('should handle sheets with undefined rows', () => {
    const sheets = [
      {
        dataPeriod: '2024-12',
        updatedAt: new Date('2024-12-18T00:00:00Z'),
        readinessLevel: 'CRITICAL' as const,
        validCount: 0,
        rows: undefined,
      },
    ]

    const result = buildSheetTrends({ sheets, top: 10 })

    expect(result.periods).toHaveLength(1)
    expect(result.series).toEqual([])
  })

  it('should handle updatedAt as string', () => {
    const sheets = [
      {
        dataPeriod: '2024-12',
        updatedAt: '2024-12-18T00:00:00.000Z', // String instead of Date
        readinessLevel: 'FULL' as const,
        validCount: 1,
        rows: [mockSanitizedRow(1, 'ASIN1', 95)],
      },
    ]

    const result = buildSheetTrends({ sheets, top: 1 })

    expect(result.periods[0].updatedAt).toBe('2024-12-18T00:00:00.000Z')
  })

  it('should handle invalid updatedAt date', () => {
    const sheets = [
      {
        dataPeriod: '2024-12',
        updatedAt: 'invalid-date',
        readinessLevel: 'FULL' as const,
        validCount: 1,
        rows: [mockSanitizedRow(1, 'ASIN1', 95)],
      },
    ]

    const result = buildSheetTrends({ sheets, top: 1 })

    // Should fallback to current date (ISO string)
    expect(result.periods[0].updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('should default to CRITICAL readinessLevel when missing', () => {
    const sheets = [
      {
        dataPeriod: '2024-12',
        updatedAt: new Date('2024-12-18T00:00:00Z'),
        readinessLevel: null,
        validCount: null,
        rows: [],
      },
    ]

    const result = buildSheetTrends({ sheets, top: 10 })

    expect(result.periods[0].readinessLevel).toBe('CRITICAL')
    expect(result.periods[0].validCount).toBe(0)
  })
})
