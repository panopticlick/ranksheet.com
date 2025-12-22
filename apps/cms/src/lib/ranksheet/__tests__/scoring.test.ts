import { describe, expect, it } from 'vitest'

import type { CandidateRow } from '../dedupe'
import { computeSanitizedRows } from '../scoring'

describe('computeSanitizedRows', () => {
  const mockCard = {
    asin: 'TEST_ASIN',
    title: 'Test Product',
    brand: 'Test Brand',
    image: 'https://example.com/image.jpg',
    parentAsin: null,
    variationGroup: null,
  }

  it('should handle division by zero gracefully', () => {
    const rows: CandidateRow[] = [
      {
        rank: 1,
        asin: 'A1',
        clickShare: 0,
        conversionShare: 0,
        card: mockCard,
      },
    ]

    const result = computeSanitizedRows({
      rows,
      prevRankByAsin: new Map(),
      multipleOptionsAsins: new Set(),
    })

    expect(result).toHaveLength(1)
    expect(Number.isFinite(result[0].marketShareIndex)).toBe(true)
    expect(Number.isFinite(result[0].buyerTrustIndex)).toBe(true)
    expect(Number.isFinite(result[0].score)).toBe(true)
  })

  it('should clamp values to 0-100 range', () => {
    const rows: CandidateRow[] = [
      {
        rank: 1,
        asin: 'A1',
        clickShare: 999999,
        conversionShare: 999999,
        card: mockCard,
      },
      {
        rank: 2,
        asin: 'A2',
        clickShare: 1,
        conversionShare: 1,
        card: mockCard,
      },
    ]

    const result = computeSanitizedRows({
      rows,
      prevRankByAsin: new Map(),
      multipleOptionsAsins: new Set(),
    })

    result.forEach((row) => {
      expect(row.marketShareIndex).toBeGreaterThanOrEqual(0)
      expect(row.marketShareIndex).toBeLessThanOrEqual(100)
      expect(row.buyerTrustIndex).toBeGreaterThanOrEqual(0)
      expect(row.buyerTrustIndex).toBeLessThanOrEqual(100)
      expect(row.score).toBeGreaterThanOrEqual(0)
      expect(row.score).toBeLessThanOrEqual(100)
    })
  })

  it('should handle NaN/Infinity from malformed data', () => {
    const rows: CandidateRow[] = [
      {
        rank: 1,
        asin: 'A1',
        clickShare: NaN,
        conversionShare: Infinity,
        card: mockCard,
      },
      {
        rank: 2,
        asin: 'A2',
        clickShare: -Infinity,
        conversionShare: NaN,
        card: mockCard,
      },
    ]

    const result = computeSanitizedRows({
      rows,
      prevRankByAsin: new Map(),
      multipleOptionsAsins: new Set(),
    })

    // NaN/Infinity values get filtered by Number.isFinite checks or converted to safe defaults
    // Since both rows have invalid data, they may be filtered out or converted to safe values
    result.forEach((row) => {
      // marketShareIndex should be finite (0-100)
      expect(Number.isFinite(row.marketShareIndex)).toBe(true)
      expect(row.marketShareIndex).toBeGreaterThanOrEqual(0)
      expect(row.marketShareIndex).toBeLessThanOrEqual(100)

      // buyerTrustIndex should be finite (0-100)
      expect(Number.isFinite(row.buyerTrustIndex)).toBe(true)
      expect(row.buyerTrustIndex).toBeGreaterThanOrEqual(0)
      expect(row.buyerTrustIndex).toBeLessThanOrEqual(100)

      // score should be finite (1-100)
      expect(Number.isFinite(row.score)).toBe(true)
      expect(row.score).toBeGreaterThanOrEqual(1)
      expect(row.score).toBeLessThanOrEqual(100)
    })
  })

  it('should filter out rows without complete card data', () => {
    const rows: CandidateRow[] = [
      {
        rank: 1,
        asin: 'A1',
        clickShare: 10,
        conversionShare: 5,
        card: mockCard,
      },
      {
        rank: 2,
        asin: 'A2',
        clickShare: 8,
        conversionShare: 4,
        card: { ...mockCard, title: '' }, // Missing title
      },
      {
        rank: 3,
        asin: 'A3',
        clickShare: 6,
        conversionShare: 3,
        card: null, // Missing card
      },
    ]

    const result = computeSanitizedRows({
      rows,
      prevRankByAsin: new Map(),
      multipleOptionsAsins: new Set(),
    })

    expect(result).toHaveLength(1)
    expect(result[0].asin).toBe('A1')
  })

  it('should compute trend labels correctly', () => {
    const rows: CandidateRow[] = [
      {
        rank: 1,
        asin: 'RISING',
        clickShare: 10,
        conversionShare: 5,
        card: mockCard,
      },
      {
        rank: 5,
        asin: 'FALLING',
        clickShare: 8,
        conversionShare: 4,
        card: mockCard,
      },
      {
        rank: 3,
        asin: 'STABLE',
        clickShare: 6,
        conversionShare: 3,
        card: mockCard,
      },
    ]

    const prevRankByAsin = new Map([
      ['RISING', 10], // Was rank 10, now rank 1 (delta: +9, rising)
      ['FALLING', 1], // Was rank 1, now rank 5 (delta: -4, falling)
      ['STABLE', 3], // Was rank 3, still rank 3 (delta: 0, stable)
    ])

    const result = computeSanitizedRows({
      rows,
      prevRankByAsin,
      multipleOptionsAsins: new Set(),
    })

    // trendDelta = prevRank - currentRank
    // Rising needs delta >= 3, Falling needs delta <= -3
    expect(result[0].trendLabel).toBe('Rising')
    expect(result[0].trendDelta).toBe(9) // 10 - 1 = 9

    expect(result[1].trendLabel).toBe('Falling')
    expect(result[1].trendDelta).toBe(-4) // 1 - 5 = -4

    expect(result[2].trendLabel).toBe('Stable')
    expect(result[2].trendDelta).toBe(0) // 3 - 3 = 0
  })

  it('should add "Multiple Options" badge', () => {
    const rows: CandidateRow[] = [
      {
        rank: 1,
        asin: 'A1',
        clickShare: 10,
        conversionShare: 5,
        card: mockCard,
      },
    ]

    const result = computeSanitizedRows({
      rows,
      prevRankByAsin: new Map(),
      multipleOptionsAsins: new Set(['A1']),
    })

    expect(result[0].badges).toContain('🎨 Multiple Options')
  })

  it('should handle empty input', () => {
    const result = computeSanitizedRows({
      rows: [],
      prevRankByAsin: new Map(),
      multipleOptionsAsins: new Set(),
    })

    expect(result).toEqual([])
  })

  it('should assign correct rank values', () => {
    const rows: CandidateRow[] = [
      {
        rank: 1,
        asin: 'A1',
        clickShare: 10,
        conversionShare: 5,
        card: mockCard,
      },
      {
        rank: 2,
        asin: 'A2',
        clickShare: 8,
        conversionShare: 4,
        card: mockCard,
      },
      {
        rank: 3,
        asin: 'A3',
        clickShare: 6,
        conversionShare: 3,
        card: mockCard,
      },
    ]

    const result = computeSanitizedRows({
      rows,
      prevRankByAsin: new Map(),
      multipleOptionsAsins: new Set(),
    })

    expect(result[0].rank).toBe(1)
    expect(result[1].rank).toBe(2)
    expect(result[2].rank).toBe(3)
  })
})
