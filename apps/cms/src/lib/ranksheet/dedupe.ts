import type { ProductCard } from '@/lib/ranksheet/productCard'

export type CandidateRow = {
  rank: number
  asin: string
  clickShare: number
  conversionShare: number
  card: ProductCard | null
}

const COLOR_WORDS = new Set([
  'black',
  'white',
  'gray',
  'grey',
  'red',
  'blue',
  'green',
  'pink',
  'purple',
  'gold',
  'silver',
  'yellow',
  'orange',
  'beige',
  'brown',
  'navy',
  'ivory',
])

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function titleTokens(title: string): string[] {
  const tokens = normalizeText(title).split(/\s+/).filter(Boolean)
  return tokens.filter((t) => !COLOR_WORDS.has(t))
}

function computeWeakGroupKey(card: ProductCard): string | null {
  if (!card.brand || !card.title) return null
  const brand = normalizeText(card.brand)
  const tokens = titleTokens(card.title)
  if (tokens.length < 4) return null
  return `${brand}|${tokens.slice(0, 10).join(' ')}`
}

function computeGroupKey(card: ProductCard): string | null {
  const strong = card.parentAsin || card.variationGroup
  if (strong) return `strong|${strong}`
  const weak = computeWeakGroupKey(card)
  if (weak) return `weak|${weak}`
  return null
}

export function dedupeVariations(rows: CandidateRow[]): {
  kept: CandidateRow[]
  removed: CandidateRow[]
  groupCountByKey: Map<string, number>
  groupKeyByAsin: Map<string, string>
} {
  const groupKeyByAsin = new Map<string, string>()
  const groupCountByKey = new Map<string, number>()

  for (const row of rows) {
    if (!row.card) continue
    const key = computeGroupKey(row.card)
    if (!key) continue
    groupKeyByAsin.set(row.asin, key)
    groupCountByKey.set(key, (groupCountByKey.get(key) ?? 0) + 1)
  }

  const seen = new Set<string>()
  const kept: CandidateRow[] = []
  const removed: CandidateRow[] = []

  for (const row of rows) {
    const key = groupKeyByAsin.get(row.asin)
    if (!key) {
      kept.push(row)
      continue
    }

    if (seen.has(key)) {
      removed.push(row)
      continue
    }

    seen.add(key)
    kept.push(row)
  }

  return { kept, removed, groupCountByKey, groupKeyByAsin }
}
