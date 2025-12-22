import { describe, expect, it } from 'vitest'

import { dedupeVariations, type CandidateRow } from '@/lib/ranksheet/dedupe'

function row(args: Partial<CandidateRow> & Pick<CandidateRow, 'asin' | 'rank'>): CandidateRow {
  return {
    asin: args.asin,
    rank: args.rank,
    clickShare: args.clickShare ?? 0.1,
    conversionShare: args.conversionShare ?? 0.05,
    card:
      args.card ??
      ({
        title: 'Test Product',
        brand: 'Brand',
        image: 'https://m.media-amazon.com/images/I/test.jpg',
        parentAsin: null,
        variationGroup: null,
      } as any),
  }
}

describe('dedupeVariations', () => {
  it('dedupes strong groups (parentAsin)', () => {
    const rows: CandidateRow[] = [
      row({
        asin: 'A1',
        rank: 1,
        card: {
          title: 'Acme Widget',
          brand: 'Acme',
          image: 'https://m.media-amazon.com/images/I/a1.jpg',
          parentAsin: 'PARENT',
          variationGroup: null,
        } as any,
      }),
      row({
        asin: 'A2',
        rank: 2,
        card: {
          title: 'Acme Widget (Blue)',
          brand: 'Acme',
          image: 'https://m.media-amazon.com/images/I/a2.jpg',
          parentAsin: 'PARENT',
          variationGroup: null,
        } as any,
      }),
    ]

    const res = dedupeVariations(rows)
    expect(res.kept.map((r) => r.asin)).toEqual(['A1'])
    expect(res.removed.map((r) => r.asin)).toEqual(['A2'])
  })

  it('dedupes weak groups (brand + normalized title tokens)', () => {
    const rows: CandidateRow[] = [
      row({
        asin: 'B1',
        rank: 1,
        card: {
          title: 'Acme Widget Black Large 2 Pack',
          brand: 'Acme',
          image: 'https://m.media-amazon.com/images/I/b1.jpg',
          parentAsin: null,
          variationGroup: null,
        } as any,
      }),
      row({
        asin: 'B2',
        rank: 2,
        card: {
          title: 'Acme Widget White Large 2 Pack',
          brand: 'Acme',
          image: 'https://m.media-amazon.com/images/I/b2.jpg',
          parentAsin: null,
          variationGroup: null,
        } as any,
      }),
    ]

    const res = dedupeVariations(rows)
    expect(res.kept.map((r) => r.asin)).toEqual(['B1'])
    expect(res.removed.map((r) => r.asin)).toEqual(['B2'])
  })
})

