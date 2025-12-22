import { ReadinessLevelSchema, SanitizedRowSchema } from '@ranksheet/shared'
import { z } from 'zod'

type SheetLike = {
  dataPeriod: string
  updatedAt: Date | string
  readinessLevel?: z.infer<typeof ReadinessLevelSchema> | null
  validCount?: number | null
  rows?: unknown
}

type SanitizedRow = z.infer<typeof SanitizedRowSchema>

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString()
  const d = new Date(value)
  return Number.isFinite(d.valueOf()) ? d.toISOString() : new Date().toISOString()
}

function pickTopRows(rows: SanitizedRow[], top: number): SanitizedRow[] {
  return rows.slice(0, Math.max(0, Math.min(20, top)))
}

export function buildSheetTrends(args: { sheets: SheetLike[]; top: number }): {
  periods: Array<{
    dataPeriod: string
    updatedAt: string
    readinessLevel: z.infer<typeof ReadinessLevelSchema>
    validCount: number
  }>
  series: Array<{
    asin: string
    title: string
    brand: string
    image: string
    points: Array<{ dataPeriod: string; rank: number | null; score: number | null }>
  }>
} {
  const sheets = args.sheets ?? []
  if (sheets.length === 0) return { periods: [], series: [] }

  const newest = sheets[0]!
  const newestRows = Array.isArray(newest.rows)
    ? newest.rows
        .map((r) => SanitizedRowSchema.safeParse(r))
        .filter((r) => r.success)
        .map((r) => r.data)
    : []

  const latestTop = pickTopRows(newestRows, args.top)

  const periods = sheets
    .map((d) => ({
      dataPeriod: d.dataPeriod,
      updatedAt: toIso(d.updatedAt),
      readinessLevel: d.readinessLevel ?? 'CRITICAL',
      validCount: d.validCount ?? 0,
    }))
    .reverse()

  const rowMapByPeriod = new Map<string, Map<string, SanitizedRow>>()
  for (const sheet of sheets) {
    const rows = Array.isArray(sheet.rows) ? sheet.rows : []
    const asinMap = new Map<string, SanitizedRow>()
    for (const item of rows) {
      const parsed = SanitizedRowSchema.safeParse(item)
      if (!parsed.success) continue
      asinMap.set(parsed.data.asin, parsed.data)
    }
    rowMapByPeriod.set(sheet.dataPeriod, asinMap)
  }

  const series = latestTop.map((latest) => {
    const points = periods.map((p) => {
      const row = rowMapByPeriod.get(p.dataPeriod)?.get(latest.asin)
      return {
        dataPeriod: p.dataPeriod,
        rank: row?.rank ?? null,
        score: typeof row?.score === 'number' ? row.score : null,
      }
    })
    return {
      asin: latest.asin,
      title: latest.title,
      brand: latest.brand,
      image: latest.image,
      points,
    }
  })

  return { periods, series }
}
