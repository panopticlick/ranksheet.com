import { NextResponse } from 'next/server'
import { z } from 'zod'

import { PublicSheetsResponseSchema, ReadinessLevelSchema } from '@ranksheet/shared'

import { getDbPool } from '@/lib/db/pool'
import { getPayloadClient } from '@/lib/payload/client'
import { enforceRateLimit } from '@/lib/security/rateLimit'
import type { Keyword, RankSheet } from '@/payload-types'

const QuerySchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-\d{2}(?:-\d{2})?$/)
    .optional(),
  periodsLimit: z.coerce.number().int().min(2).max(36).optional(),
  relatedLimit: z.coerce.number().int().min(1).max(50).optional(),
})

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

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const limited = await enforceRateLimit(request, { name: 'public_sheets', limit: 120, windowSeconds: 60 })
  if (limited) return limited

  const params = await context.params
  const slug = params.slug

  const url = new URL(request.url)
  const parsedQuery = QuerySchema.safeParse({
    period: url.searchParams.get('period') ?? undefined,
    periodsLimit: url.searchParams.get('periodsLimit') ?? undefined,
    relatedLimit: url.searchParams.get('relatedLimit') ?? undefined,
  })
  if (!parsedQuery.success) return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 })

  const requestedPeriod = parsedQuery.data.period ?? null
  const isMonthOnly = !!requestedPeriod && requestedPeriod.length === 7
  const periodsLimit = parsedQuery.data.periodsLimit ?? 18
  const relatedLimit = parsedQuery.data.relatedLimit ?? 9

  const payload = await getPayloadClient()

  const keywordRes = await payload.find({
    collection: 'keywords',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })

  const keywordDoc = keywordRes.docs[0] as Keyword | undefined
  if (!keywordDoc) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  // NOTE: Payload <-> Postgres column naming for `rank-sheets` differs from the existing DB schema in local dev,
  // which can cause `payload.find({ collection: 'rank-sheets' ... })` to error on camelCase columns like `readinessLevel`.
  // For public sheets we can safely read the latest row directly.
  const pool = getDbPool()

  const sheetRow = requestedPeriod
    ? await pool
        .query<{
          dataPeriod: string
          updatedAt: string | Date | null
          mode: string
          validCount: number | string | null
          readinessLevel: string | null
          rows: unknown
        }>(
          isMonthOnly
            ? `select
                data_period as "dataPeriod",
                updated_at as "updatedAt",
                mode,
                valid_count as "validCount",
                readiness_level as "readinessLevel",
                rows
              from ranksheet.rank_sheets
              where keyword_id = $1
                and data_period like $2
              order by data_period desc
              limit 1`
            : `select
                data_period as "dataPeriod",
                updated_at as "updatedAt",
                mode,
                valid_count as "validCount",
                readiness_level as "readinessLevel",
                rows
              from ranksheet.rank_sheets
              where keyword_id = $1
                and data_period = $2
              limit 1`,
          [keywordDoc.id, isMonthOnly ? `${requestedPeriod}-%` : requestedPeriod],
        )
        .then((r) => r.rows[0] ?? null)
        .catch(() => null)
    : null

  const resolvedSheetRow =
    sheetRow ??
    (await pool
      .query<{
        dataPeriod: string
        updatedAt: string | Date | null
        mode: string
        validCount: number | string | null
        readinessLevel: string | null
        rows: unknown
      }>(
        `select
          data_period as "dataPeriod",
          updated_at as "updatedAt",
          mode,
          valid_count as "validCount",
          readiness_level as "readinessLevel",
          rows
        from ranksheet.rank_sheets
        where keyword_id = $1
        order by data_period desc
        limit 1`,
        [keywordDoc.id],
      )
      .then((r) => r.rows[0] ?? null)
      .catch(() => null))

  const sheetDoc: Pick<RankSheet, 'dataPeriod' | 'updatedAt' | 'mode' | 'validCount' | 'readinessLevel' | 'rows'> | null =
    resolvedSheetRow
      ? {
          dataPeriod: resolvedSheetRow.dataPeriod,
          updatedAt: toIso(resolvedSheetRow.updatedAt),
          mode: resolvedSheetRow.mode as RankSheet['mode'],
          validCount: toInt(resolvedSheetRow.validCount),
          readinessLevel: toReadiness(resolvedSheetRow.readinessLevel),
          rows: resolvedSheetRow.rows as RankSheet['rows'],
        }
      : null

  const availablePeriods = await pool
    .query<{
      dataPeriod: string
      updatedAt: string | Date | null
      readinessLevel: string | null
      validCount: number | string | null
    }>(
      `select
        data_period as "dataPeriod",
        updated_at as "updatedAt",
        readiness_level as "readinessLevel",
        valid_count as "validCount"
      from ranksheet.rank_sheets
      where keyword_id = $1
      order by data_period desc
      limit $2`,
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
        })),
    )
    .catch(() => [] as Array<{ dataPeriod: string; updatedAt: string; readinessLevel: RankSheet['readinessLevel']; validCount: number }>)

  // Fetch limit + 1 to determine if there are more results
  const relatedRes = await payload.find({
    collection: 'keywords',
    where: {
      and: [
        { id: { not_equals: keywordDoc.id } },
        { isActive: { equals: true } },
        { status: { equals: 'ACTIVE' } },
        { indexable: { equals: true } },
        ...(keywordDoc.category ? [{ category: { equals: keywordDoc.category } }] : []),
        ...(keywordDoc.marketplace ? [{ marketplace: { equals: keywordDoc.marketplace } }] : []),
      ],
    },
    sort: '-lastRefreshedAt',
    limit: relatedLimit + 1,
    overrideAccess: true,
    depth: 0,
  })

  const hasMoreRelated = relatedRes.docs.length > relatedLimit
  const relatedDocs = (relatedRes.docs as Keyword[]).slice(0, relatedLimit)

  const response = {
    keyword: {
      slug: keywordDoc.slug,
      keyword: keywordDoc.keyword,
      title: keywordDoc.title ?? null,
      description: keywordDoc.description ?? null,
      category: keywordDoc.category ?? null,
      marketplace: keywordDoc.marketplace ?? null,
      topN: keywordDoc.topN ?? undefined,
      indexable: !!keywordDoc.indexable,
      status: keywordDoc.status,
      statusReason: keywordDoc.statusReason ?? null,
      priority: keywordDoc.priority ?? 0,
      lastRefreshedAt: keywordDoc.lastRefreshedAt ?? null,
      updatedAt: keywordDoc.updatedAt,
    },
    sheet: sheetDoc
      ? {
          dataPeriod: sheetDoc.dataPeriod,
          updatedAt: sheetDoc.updatedAt,
          mode: sheetDoc.mode,
          validCount: sheetDoc.validCount ?? 0,
          readinessLevel: sheetDoc.readinessLevel,
          rows: Array.isArray(sheetDoc.rows) ? sheetDoc.rows : [],
        }
      : null,
    availablePeriods,
    related: relatedDocs.map((k) => ({
      slug: k.slug,
      keyword: k.keyword,
      topN: k.topN ?? undefined,
      lastRefreshedAt: k.lastRefreshedAt ?? null,
    })),
    relatedPagination: {
      limit: relatedLimit,
      hasMore: hasMoreRelated,
    },
  }

  const parsed = PublicSheetsResponseSchema.safeParse(response)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_sheet_shape' }, { status: 500 })
  }

  const cacheControl = sheetDoc ? 's-maxage=3600, stale-while-revalidate=86400' : 's-maxage=60, stale-while-revalidate=600'
  const lastModified = sheetDoc?.updatedAt ?? keywordDoc.updatedAt

  return NextResponse.json(parsed.data, {
    headers: {
      'Cache-Control': cacheControl,
      ...(lastModified ? { 'Last-Modified': new Date(lastModified).toUTCString() } : {}),
    },
  })
}
