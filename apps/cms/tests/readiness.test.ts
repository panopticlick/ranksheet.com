import { describe, expect, it } from 'vitest'

import type { CandidateRow } from '@/lib/ranksheet/dedupe'
import { computeReadiness } from '@/lib/ranksheet/readiness'

function makeRow(args: { asin: string; hasImage: boolean }): CandidateRow {
  return {
    asin: args.asin,
    rank: 1,
    clickShare: 0.1,
    conversionShare: 0.05,
    card: args.hasImage
      ? ({
          title: 'T',
          brand: 'B',
          image: 'https://m.media-amazon.com/images/I/test.jpg',
        } as any)
      : ({
          title: 'T',
          brand: 'B',
          image: null,
        } as any),
  }
}

describe('computeReadiness', () => {
  it('returns FULL when >= 90% ready in topK', () => {
    const rows: CandidateRow[] = []
    for (let i = 0; i < 10; i++) rows.push(makeRow({ asin: `A${i}`, hasImage: i !== 9 }))
    const res = computeReadiness(rows, 10)
    expect(res.level).toBe('FULL')
    expect(res.ready).toBe(9)
    expect(res.missingAsins).toEqual(['A9'])
  })

  it('returns CRITICAL when < 50% ready', () => {
    const rows: CandidateRow[] = []
    for (let i = 0; i < 10; i++) rows.push(makeRow({ asin: `B${i}`, hasImage: i < 4 }))
    const res = computeReadiness(rows, 10)
    expect(res.level).toBe('CRITICAL')
    expect(res.ready).toBe(4)
    expect(res.missingAsins.length).toBe(6)
  })
})

