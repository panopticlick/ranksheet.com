import { NextResponse } from 'next/server'
import { z } from 'zod'

import { ReadinessLevelSchema } from '@ranksheet/shared'

import { getDbPool } from '@/lib/db/pool'
import { buildSheetTrends } from '@/lib/ranksheet/trends'
import { getPayloadClient } from '@/lib/payload/client'
import { enforceRateLimit } from '@/lib/security/rateLimit'
import type { Keyword, RankSheet } from '@/payload-types'

function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString()
  const d = value instanceof Date ? value : new Date(value)
  return Number.isFinite(d.valueOf()) ? d.toISOString() : new Date().toISOString()
}

function toReadiness(value: unknown): z.infer<typeof ReadinessLevelSchema> {
  const parsed = ReadinessLevelSchema.safeParse(value)
  return parsed.success ? parsed.data : 'CRITICAL'
}

function toInt(value: number | string | null | undefined): number {
  if (value == null) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : 0
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : 0
}

const ParamsSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
})

const QuerySchema = z.object({
  periods: z.coerce.number().int().min(2).max(24).optional(),
  top: z.coerce.number().int().min(3).max(20).optional(),
  asOf: z.string().regex(/^\d{4}-\d{2}(?:-\d{2})?$/).optional(),
})

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const limited = await enforceRateLimit(request, { name: 'public_sheet_trends', limit: 120, windowSeconds: 60 })
  if (limited) return limited

  const params = await context.params
  const parsedParams = ParamsSchema.safeParse({ slug: params.slug })
  if (!parsedParams.success) return NextResponse.json({ ok: false, error: 'invalid_slug' }, { status: 400 })

  const url = new URL(request.url)
  const parsedQuery = QuerySchema.safeParse({
    periods: url.searchParams.get('periods') ?? undefined,
    top: url.searchParams.get('top') ?? undefined,
    asOf: url.searchParams.get('asOf') ?? undefined,
  })
  if (!parsedQuery.success) return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 })

  const slug = parsedParams.data.slug
  const periodsLimit = parsedQuery.data.periods ?? 8
  const topLimit = parsedQuery.data.top ?? 10
  const asOf = parsedQuery.data.asOf ?? null
  const isMonthOnly = !!asOf && asOf.length === 7

  const payload = await getPayloadClient()

  const keywordRes = await payload.find({
    collection: 'keywords',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })

  const keywordDoc = keywordRes.docs[0] as Keyword | undefined
  if (!keywordDoc) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

  const pool = getDbPool()
  const resolvedAsOf = isMonthOnly
    ? await pool
        .query<{ dataPeriod: string }>(
          `
            select data_period as "dataPeriod"
            from ranksheet.rank_sheets
            where keyword_id = $1
              and data_period like $2
            order by data_period desc
            limit 1
          `,
          [keywordDoc.id, `${asOf}-%`],
        )
        .then((r) => r.rows[0]?.dataPeriod ?? null)
        .catch(() => null)
    : asOf

  const baseQuery = `
    select
      data_period as "dataPeriod",
      updated_at as "updatedAt",
      readiness_level as "readinessLevel",
      valid_count as "validCount",
      rows
    from ranksheet.rank_sheets
    where keyword_id = $1
    ${resolvedAsOf ? 'and data_period <= $2' : ''}
    order by data_period desc
    limit $${resolvedAsOf ? 3 : 2}
  `

  const sheetRows = await pool
    .query<{
      dataPeriod: string
      updatedAt: string | Date | null
      readinessLevel: string | null
      validCount: number | string | null
      rows: unknown
    }>(baseQuery, resolvedAsOf ? [keywordDoc.id, resolvedAsOf, periodsLimit] : [keywordDoc.id, periodsLimit])
    .then((r) => r.rows)
    .catch(() => [])

  const sheets: RankSheet[] = sheetRows
    .filter((r) => !!r.dataPeriod)
    .map((r) => ({
      dataPeriod: r.dataPeriod,
      updatedAt: toIso(r.updatedAt),
      readinessLevel: toReadiness(r.readinessLevel),
      validCount: toInt(r.validCount),
      rows: r.rows as RankSheet['rows'],
    })) as RankSheet[]

  const resolvedSheets = sheets.length
    ? sheets
    : resolvedAsOf
      ? await pool
          .query<{
            dataPeriod: string
            updatedAt: string | Date | null
            readinessLevel: string | null
            validCount: number | string | null
            rows: unknown
          }>(
            `
              select
                data_period as "dataPeriod",
                updated_at as "updatedAt",
                readiness_level as "readinessLevel",
                valid_count as "validCount",
                rows
              from ranksheet.rank_sheets
              where keyword_id = $1
              order by data_period desc
              limit $2
            `,
            [keywordDoc.id, periodsLimit],
          )
          .then((r) =>
            r.rows
              .filter((row) => !!row.dataPeriod)
              .map((row) => ({
                dataPeriod: row.dataPeriod,
                updatedAt: toIso(row.updatedAt),
                readinessLevel: toReadiness(row.readinessLevel),
                validCount: toInt(row.validCount),
                rows: row.rows as RankSheet['rows'],
              })) as RankSheet[],
          )
          .catch(() => [] as RankSheet[])
    : sheets

  if (resolvedSheets.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        slug,
        keyword: { slug: keywordDoc.slug, keyword: keywordDoc.keyword },
        periods: [],
        series: [],
      },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=3600' } },
    )
  }

  const { periods, series } = buildSheetTrends({ sheets: resolvedSheets, top: topLimit })

  const lastModified = resolvedSheets[0]?.updatedAt ?? keywordDoc.updatedAt

  return NextResponse.json(
    {
      ok: true,
      slug,
      keyword: { slug: keywordDoc.slug, keyword: keywordDoc.keyword },
      periods,
      series,
    },
    {
      headers: {
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
        ...(lastModified ? { 'Last-Modified': new Date(lastModified).toUTCString() } : {}),
      },
    },
  )
}
