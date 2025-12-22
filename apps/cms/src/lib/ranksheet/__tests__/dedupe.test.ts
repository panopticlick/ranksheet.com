import { describe, expect, it } from 'vitest'

import type { CandidateRow } from '../dedupe'
import { dedupeVariations } from '../dedupe'

describe('dedupeVariations', () => {
  it('should dedupe variants with same parentAsin', () => {
    const rows: CandidateRow[] = [
      {
        rank: 1,
        asin: 'VARIANT1',
        clickShare: 10,
        conversionShare: 5,
        card: {
        asin: 'VARIANT1',
          title: 'Product A - Red',
          brand: 'Brand X',
          image: 'https://example.com/1.jpg',
          parentAsin: 'PARENT1',
          variationGroup: null,
        },
      },
      {
        rank: 2,
        asin: 'VARIANT2',
        clickShare: 8,
        conversionShare: 4,
        card: {
        asin: 'VARIANT2',
          title: 'Product A - Blue',
          brand: 'Brand X',
          image: 'https://example.com/2.jpg',
          parentAsin: 'PARENT1',
          variationGroup: null,
        },
      },
      {
        rank: 3,
        asin: 'VARIANT3',
        clickShare: 6,
        conversionShare: 3,
        card: {
        asin: 'VARIANT3',
          title: 'Product A - Green',
          brand: 'Brand X',
          image: 'https://example.com/3.jpg',
          parentAsin: 'PARENT1',
          variationGroup: null,
        },
      },
    ]

    const result = dedupeVariations(rows)

    // Should keep first one, remove others with same parentAsin
    expect(result.kept).toHaveLength(1)
    expect(result.kept[0].asin).toBe('VARIANT1')
    expect(result.removed).toHaveLength(2)
    expect(result.groupKeyByAsin.get('VARIANT1')).toBe('strong|PARENT1')
  })

  it('should handle null/undefined parentAsin gracefully', () => {
    const rows: CandidateRow[] = [
      {
        rank: 1,
        asin: 'A1',
        clickShare: 10,
        conversionShare: 5,
        card: {
        asin: 'A1',
          title: 'Product A',
          brand: 'Brand X',
          image: 'https://example.com/1.jpg',
          parentAsin: null,
          variationGroup: null,
        },
      },
      {
        rank: 2,
        asin: 'A2',
        clickShare: 8,
        conversionShare: 4,
        card: {
        asin: 'A2',
          title: 'Product B',
          brand: 'Brand Y',
          image: 'https://example.com/2.jpg',
          parentAsin: null,
          variationGroup: null,
        },
      },
    ]

    expect(() => dedupeVariations(rows)).not.toThrow()
    const result = dedupeVariations(rows)
    expect(result.kept).toHaveLength(2)
  })

  it('should dedupe by variation group', () => {
    const rows: CandidateRow[] = [
      {
        rank: 1,
        asin: 'VAR1',
        clickShare: 10,
        conversionShare: 5,
        card: {
        asin: 'VARIANT1',
          title: 'Product Set - Option 1',
          brand: 'Brand X',
          image: 'https://example.com/1.jpg',
          parentAsin: null,
          variationGroup: 'GROUP123',
        },
      },
      {
        rank: 2,
        asin: 'VAR2',
        clickShare: 8,
        conversionShare: 4,
        card: {
        asin: 'VARIANT1',
          title: 'Product Set - Option 2',
          brand: 'Brand X',
          image: 'https://example.com/2.jpg',
          parentAsin: null,
          variationGroup: 'GROUP123',
        },
      },
    ]

    const result = dedupeVariations(rows)

    expect(result.kept).toHaveLength(1)
    expect(result.removed).toHaveLength(1)
    expect(result.groupCountByKey.get('strong|GROUP123')).toBe(2)
  })

  it('should dedupe by weak matching (brand + title tokens)', () => {
    const rows: CandidateRow[] = [
      {
        rank: 1,
        asin: 'A1',
        clickShare: 10,
        conversionShare: 5,
        card: {
        asin: 'VARIANT1',
          title: 'Wireless Bluetooth Headphones with Noise Cancellation',
          brand: 'TechBrand',
          image: 'https://example.com/1.jpg',
          parentAsin: null,
          variationGroup: null,
        },
      },
      {
        rank: 2,
        asin: 'A2',
        clickShare: 8,
        conversionShare: 4,
        card: {
        asin: 'VARIANT1',
          title: 'Wireless Bluetooth Headphones with Noise Cancellation (Black)',
          brand: 'TechBrand',
          image: 'https://example.com/2.jpg',
          parentAsin: null,
          variationGroup: null,
        },
      },
    ]

    const result = dedupeVariations(rows)

    // Should dedupe based on similar titles (color variant)
    expect(result.kept).toHaveLength(1)
    expect(result.removed).toHaveLength(1)
  })

  it('should keep products with different brands', () => {
    const rows: CandidateRow[] = [
      {
        rank: 1,
        asin: 'A1',
        clickShare: 10,
        conversionShare: 5,
        card: {
        asin: 'VARIANT1',
          title: 'Wireless Headphones',
          brand: 'Brand A',
          image: 'https://example.com/1.jpg',
          parentAsin: null,
          variationGroup: null,
        },
      },
      {
        rank: 2,
        asin: 'A2',
        clickShare: 8,
        conversionShare: 4,
        card: {
        asin: 'VARIANT1',
          title: 'Wireless Headphones',
          brand: 'Brand B',
          image: 'https://example.com/2.jpg',
          parentAsin: null,
          variationGroup: null,
        },
      },
    ]

    const result = dedupeVariations(rows)

    // Different brands should not be deduped
    expect(result.kept).toHaveLength(2)
    expect(result.removed).toHaveLength(0)
  })

  it('should handle rows without card data', () => {
    const rows: CandidateRow[] = [
      {
        rank: 1,
        asin: 'A1',
        clickShare: 10,
        conversionShare: 5,
        card: {
        asin: 'VARIANT1',
          title: 'Product A',
          brand: 'Brand X',
          image: 'https://example.com/1.jpg',
          parentAsin: null,
          variationGroup: null,
        },
      },
      {
        rank: 2,
        asin: 'A2',
        clickShare: 8,
        conversionShare: 4,
        card: null,
      },
      {
        rank: 3,
        asin: 'A3',
        clickShare: 6,
        conversionShare: 3,
        card: {
        asin: 'VARIANT1',
          title: 'Product C',
          brand: 'Brand Z',
          image: 'https://example.com/3.jpg',
          parentAsin: null,
          variationGroup: null,
        },
      },
    ]

    const result = dedupeVariations(rows)

    // All rows should be kept (no duplicates, null card ignored)
    expect(result.kept).toHaveLength(3)
    expect(result.removed).toHaveLength(0)
  })

  it('should handle empty input', () => {
    const result = dedupeVariations([])

    expect(result.kept).toEqual([])
    expect(result.removed).toEqual([])
    expect(result.groupCountByKey.size).toBe(0)
  })

  it('should track group counts correctly', () => {
    const rows: CandidateRow[] = [
      {
        rank: 1,
        asin: 'VAR1',
        clickShare: 10,
        conversionShare: 5,
        card: {
        asin: 'VARIANT1',
          title: 'Product - Red',
          brand: 'Brand',
          image: 'https://example.com/1.jpg',
          parentAsin: 'PARENT',
          variationGroup: null,
        },
      },
      {
        rank: 2,
        asin: 'VAR2',
        clickShare: 8,
        conversionShare: 4,
        card: {
        asin: 'VARIANT1',
          title: 'Product - Blue',
          brand: 'Brand',
          image: 'https://example.com/2.jpg',
          parentAsin: 'PARENT',
          variationGroup: null,
        },
      },
    ]

    const result = dedupeVariations(rows)

    expect(result.groupCountByKey.get('strong|PARENT')).toBe(2)
    expect(result.groupKeyByAsin.get('VAR1')).toBe('strong|PARENT')
    expect(result.groupKeyByAsin.get('VAR2')).toBe('strong|PARENT')
  })
})
