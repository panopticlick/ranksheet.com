import type { CandidateRow } from '@/lib/ranksheet/dedupe'

export type ReadinessLevel = 'FULL' | 'PARTIAL' | 'LOW' | 'CRITICAL'

export function computeReadiness(rows: CandidateRow[], topK = 10): {
  level: ReadinessLevel
  ready: number
  total: number
  ratio: number
  missingAsins: string[]
} {
  const total = Math.max(1, Math.min(topK, rows.length))
  let ready = 0
  const missingAsins: string[] = []

  for (const row of rows.slice(0, total)) {
    const ok = !!row.card?.title && !!row.card?.image
    if (ok) ready += 1
    else missingAsins.push(row.asin)
  }

  const ratio = ready / total
  const level: ReadinessLevel =
    ratio >= 0.9 ? 'FULL' : ratio >= 0.7 ? 'PARTIAL' : ratio >= 0.5 ? 'LOW' : 'CRITICAL'

  return { level, ready, total, ratio, missingAsins }
}

