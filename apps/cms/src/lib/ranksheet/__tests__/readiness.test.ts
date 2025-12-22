import { describe, it, expect } from 'vitest'
import { computeReadiness } from '../readiness'
import type { CandidateRow } from '../dedupe'

// Mock product card helper
const mockCard = (hasData: boolean) => ({
  asin: 'TEST123',
  title: hasData ? 'Test Product' : null,
  brand: hasData ? 'Test Brand' : null,
  image: hasData ? 'https://example.com/image.jpg' : null,
  parentAsin: null,
  variationGroup: null,
})

describe('computeReadiness', () => {
  it('should return FULL readiness when all rows have complete data', () => {
    const rows: CandidateRow[] = Array.from({ length: 10 }, (_, i) => ({
      rank: i + 1,
      asin: `ASIN${i}`,
      clickShare: 10 - i,
      conversionShare: 10 - i,
      card: mockCard(true),
    }))

    const result = computeReadiness(rows, 10)

    expect(result.level).toBe('FULL')
    expect(result.ready).toBe(10)
    expect(result.total).toBe(10)
    expect(result.ratio).toBe(1.0)
    expect(result.missingAsins).toEqual([])
  })

  it('should return PARTIAL readiness when 70-89% of rows have data', () => {
    const rows: CandidateRow[] = [
      // 8 complete rows
      ...Array.from({ length: 8 }, (_, i) => ({
        rank: i + 1,
        asin: `ASIN${i}`,
        clickShare: 10,
        conversionShare: 10,
        card: mockCard(true),
      })),
      // 2 incomplete rows
      ...Array.from({ length: 2 }, (_, i) => ({
        rank: i + 9,
        asin: `MISSING${i}`,
        clickShare: 5,
        conversionShare: 5,
        card: mockCard(false),
      })),
    ]

    const result = computeReadiness(rows, 10)

    expect(result.level).toBe('PARTIAL')
    expect(result.ready).toBe(8)
    expect(result.total).toBe(10)
    expect(result.ratio).toBe(0.8)
    expect(result.missingAsins).toEqual(['MISSING0', 'MISSING1'])
  })

  it('should return LOW readiness when 50-69% of rows have data', () => {
    const rows: CandidateRow[] = [
      // 6 complete rows
      ...Array.from({ length: 6 }, (_, i) => ({
        rank: i + 1,
        asin: `ASIN${i}`,
        clickShare: 10,
        conversionShare: 10,
        card: mockCard(true),
      })),
      // 4 incomplete rows
      ...Array.from({ length: 4 }, (_, i) => ({
        rank: i + 7,
        asin: `MISSING${i}`,
        clickShare: 5,
        conversionShare: 5,
        card: mockCard(false),
      })),
    ]

    const result = computeReadiness(rows, 10)

    expect(result.level).toBe('LOW')
    expect(result.ready).toBe(6)
    expect(result.total).toBe(10)
    expect(result.ratio).toBe(0.6)
    expect(result.missingAsins.length).toBe(4)
  })

  it('should return CRITICAL readiness when <50% of rows have data', () => {
    const rows: CandidateRow[] = [
      // 2 complete rows
      ...Array.from({ length: 2 }, (_, i) => ({
        rank: i + 1,
        asin: `ASIN${i}`,
        clickShare: 10,
        conversionShare: 10,
        card: mockCard(true),
      })),
      // 8 incomplete rows
      ...Array.from({ length: 8 }, (_, i) => ({
        rank: i + 3,
        asin: `MISSING${i}`,
        clickShare: 5,
        conversionShare: 5,
        card: mockCard(false),
      })),
    ]

    const result = computeReadiness(rows, 10)

    expect(result.level).toBe('CRITICAL')
    expect(result.ready).toBe(2)
    expect(result.total).toBe(10)
    expect(result.ratio).toBe(0.2)
    expect(result.missingAsins.length).toBe(8)
  })

  it('should only evaluate top K rows when specified', () => {
    const rows: CandidateRow[] = [
      // First 5 rows complete
      ...Array.from({ length: 5 }, (_, i) => ({
        rank: i + 1,
        asin: `ASIN${i}`,
        clickShare: 10,
        conversionShare: 10,
        card: mockCard(true),
      })),
      // Next 10 rows incomplete (but should be ignored)
      ...Array.from({ length: 10 }, (_, i) => ({
        rank: i + 6,
        asin: `MISSING${i}`,
        clickShare: 5,
        conversionShare: 5,
        card: mockCard(false),
      })),
    ]

    const result = computeReadiness(rows, 5)

    expect(result.level).toBe('FULL')
    expect(result.ready).toBe(5)
    expect(result.total).toBe(5)
    expect(result.ratio).toBe(1.0)
    expect(result.missingAsins).toEqual([])
  })

  it('should handle empty rows array', () => {
    const result = computeReadiness([], 10)

    expect(result.level).toBe('CRITICAL')
    expect(result.ready).toBe(0)
    expect(result.total).toBe(1) // Clamped to minimum 1
    expect(result.ratio).toBe(0)
  })

  it('should handle rows with null card', () => {
    const rows: CandidateRow[] = [
      {
        rank: 1,
        asin: 'ASIN1',
        clickShare: 10,
        conversionShare: 10,
        card: null,
      },
    ]

    const result = computeReadiness(rows, 1)

    expect(result.level).toBe('CRITICAL')
    expect(result.ready).toBe(0)
    expect(result.total).toBe(1)
    expect(result.missingAsins).toEqual(['ASIN1'])
  })

  it('should handle rows with missing title only', () => {
    const rows: CandidateRow[] = [
      {
        rank: 1,
        asin: 'ASIN1',
        clickShare: 10,
        conversionShare: 10,
        card: {
          asin: 'ASIN1',
          title: null, // Missing title
          brand: 'Brand',
          image: 'https://example.com/image.jpg',
          parentAsin: null,
          variationGroup: null,
        },
      },
    ]

    const result = computeReadiness(rows, 1)

    expect(result.level).toBe('CRITICAL')
    expect(result.ready).toBe(0)
    expect(result.missingAsins).toEqual(['ASIN1'])
  })

  it('should handle rows with missing image only', () => {
    const rows: CandidateRow[] = [
      {
        rank: 1,
        asin: 'ASIN1',
        clickShare: 10,
        conversionShare: 10,
        card: {
          asin: 'ASIN1',
          title: 'Product Title',
          brand: 'Brand',
          image: null, // Missing image
          parentAsin: null,
          variationGroup: null,
        },
      },
    ]

    const result = computeReadiness(rows, 1)

    expect(result.level).toBe('CRITICAL')
    expect(result.ready).toBe(0)
    expect(result.missingAsins).toEqual(['ASIN1'])
  })

  it('should handle boundary case: exactly 90% readiness', () => {
    const rows: CandidateRow[] = [
      // 9 complete rows
      ...Array.from({ length: 9 }, (_, i) => ({
        rank: i + 1,
        asin: `ASIN${i}`,
        clickShare: 10,
        conversionShare: 10,
        card: mockCard(true),
      })),
      // 1 incomplete row
      {
        rank: 10,
        asin: 'MISSING1',
        clickShare: 5,
        conversionShare: 5,
        card: mockCard(false),
      },
    ]

    const result = computeReadiness(rows, 10)

    expect(result.level).toBe('FULL')
    expect(result.ratio).toBe(0.9)
  })

  it('should handle boundary case: exactly 70% readiness', () => {
    const rows: CandidateRow[] = [
      // 7 complete rows
      ...Array.from({ length: 7 }, (_, i) => ({
        rank: i + 1,
        asin: `ASIN${i}`,
        clickShare: 10,
        conversionShare: 10,
        card: mockCard(true),
      })),
      // 3 incomplete rows
      ...Array.from({ length: 3 }, (_, i) => ({
        rank: i + 8,
        asin: `MISSING${i}`,
        clickShare: 5,
        conversionShare: 5,
        card: mockCard(false),
      })),
    ]

    const result = computeReadiness(rows, 10)

    expect(result.level).toBe('PARTIAL')
    expect(result.ratio).toBe(0.7)
  })

  it('should handle boundary case: exactly 50% readiness', () => {
    const rows: CandidateRow[] = [
      // 5 complete rows
      ...Array.from({ length: 5 }, (_, i) => ({
        rank: i + 1,
        asin: `ASIN${i}`,
        clickShare: 10,
        conversionShare: 10,
        card: mockCard(true),
      })),
      // 5 incomplete rows
      ...Array.from({ length: 5 }, (_, i) => ({
        rank: i + 6,
        asin: `MISSING${i}`,
        clickShare: 5,
        conversionShare: 5,
        card: mockCard(false),
      })),
    ]

    const result = computeReadiness(rows, 10)

    expect(result.level).toBe('LOW')
    expect(result.ratio).toBe(0.5)
  })
})
