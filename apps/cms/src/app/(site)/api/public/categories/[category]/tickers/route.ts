import { NextResponse } from 'next/server'
import { z } from 'zod'

import { PublicCategoryTickersResponseSchema } from '@ranksheet/shared'

import { getDbPool } from '@/lib/db/pool'
import { enforceRateLimit } from '@/lib/security/rateLimit'

const ParamsSchema = z.object({
  category: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
})

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(10).max(500).optional(),
  offset: z.coerce.number().int().min(0).max(50_000).optional(),
})

function toIso(value: Date | string | null): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const d = new Date(value)
  return Number.isFinite(d.valueOf()) ? d.toISOString() : null
}

export async function GET(request: Request, context: { params: Promise<{ category: string }> }) {
  const limited = await enforceRateLimit(request, { name: 'public_category_tickers', limit: 60, windowSeconds: 60 })
  if (limited) return limited

  const params = await context.params
  const parsedParams = ParamsSchema.safeParse({ category: params.category })
  if (!parsedParams.success) return NextResponse.json({ ok: false, error: 'invalid_category' }, { status: 400 })

  const url = new URL(request.url)
  const parsedQuery = QuerySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  })
  if (!parsedQuery.success) return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 })

  const category = parsedParams.data.category
  const limit = parsedQuery.data.limit ?? 200
  const offset = parsedQuery.data.offset ?? 0

  const pool = getDbPool()

  const tracking = await pool
    .query<{ c: string }>(
      `
        SELECT COUNT(*)::text AS c
        FROM ranksheet.keywords
        WHERE category = $1
          AND is_active = true
          AND indexable = true
          AND status = 'ACTIVE'
      `,
      [category],
    )
    .then((r) => Number.parseInt(r.rows[0]?.c ?? '0', 10) || 0)
    .catch(() => 0)

  const res = await pool.query<{
    slug: string
    keyword: string
    title: string
    top_n: string | number | null
    last_refreshed_at: Date | null
    data_period: string | null
    sheet_updated_at: Date | null
    leader: unknown | null
    max_rise: number | null
    volatility: number | null
  }>(
    `
      SELECT
        k.slug,
        k.keyword,
        COALESCE(NULLIF(k.title, ''), k.keyword) AS title,
        k.top_n::text AS top_n,
        k.last_refreshed_at,
        s.data_period,
        s.updated_at AS sheet_updated_at,
        (s.rows -> 0) AS leader,
        CASE
          WHEN s.rows IS NULL THEN NULL
          ELSE (
            SELECT MAX((elem->>'trendDelta')::int)
            FROM jsonb_array_elements(s.rows) WITH ORDINALITY AS t(elem, ord)
            WHERE ord <= 10
          )
        END AS max_rise,
        CASE
          WHEN s.rows IS NULL THEN NULL
          ELSE (
            SELECT AVG(ABS((elem->>'trendDelta')::int))
            FROM jsonb_array_elements(s.rows) WITH ORDINALITY AS t(elem, ord)
            WHERE ord <= 10
          )
        END AS volatility
      FROM ranksheet.keywords k
      LEFT JOIN LATERAL (
        SELECT data_period, updated_at, rows
        FROM ranksheet.rank_sheets
        WHERE keyword_id = k.id
        ORDER BY data_period DESC
        LIMIT 1
      ) s ON true
      WHERE k.category = $1
        AND k.is_active = true
        AND k.indexable = true
        AND k.status = 'ACTIVE'
      ORDER BY
        k.priority DESC NULLS LAST,
        k.last_refreshed_at DESC NULLS LAST,
        k.keyword ASC
      LIMIT $2
      OFFSET $3
    `,
    [category, limit, offset],
  )

  const tickers = res.rows.map((r) => ({
    slug: r.slug,
    keyword: r.keyword,
    title: r.title,
    topN: r.top_n == null ? undefined : Number.parseInt(String(r.top_n), 10) || undefined,
    lastRefreshedAt: toIso(r.last_refreshed_at),
    dataPeriod: r.data_period ?? null,
    updatedAt: toIso(r.sheet_updated_at),
    leader: (r.leader as unknown) ?? null,
    maxRise: typeof r.max_rise === 'number' && Number.isFinite(r.max_rise) ? Math.trunc(r.max_rise) : null,
    volatility: typeof r.volatility === 'number' && Number.isFinite(r.volatility) ? r.volatility : null,
  }))

  let topGainer: (typeof tickers)[number] | null | undefined = undefined
  let mostVolatile: (typeof tickers)[number] | null | undefined = undefined

  if (offset === 0) {
    const topGainerRow = await pool
      .query<{
        slug: string
        keyword: string
        title: string
        top_n: string | number | null
        last_refreshed_at: Date | null
        data_period: string | null
        sheet_updated_at: Date | null
        leader: unknown | null
        max_rise: number | null
        volatility: number | null
      }>(
        `
          WITH base AS (
            SELECT
              k.slug,
              k.keyword,
              COALESCE(NULLIF(k.title, ''), k.keyword) AS title,
              k.top_n::text AS top_n,
              k.last_refreshed_at,
              s.data_period,
              s.updated_at AS sheet_updated_at,
              (s.rows -> 0) AS leader,
              CASE
                WHEN s.rows IS NULL THEN NULL
                ELSE (
                  SELECT MAX((elem->>'trendDelta')::int)
                  FROM jsonb_array_elements(s.rows) WITH ORDINALITY AS t(elem, ord)
                  WHERE ord <= 10
                )
              END AS max_rise,
              CASE
                WHEN s.rows IS NULL THEN NULL
                ELSE (
                  SELECT AVG(ABS((elem->>'trendDelta')::int))
                  FROM jsonb_array_elements(s.rows) WITH ORDINALITY AS t(elem, ord)
                  WHERE ord <= 10
                )
              END AS volatility
            FROM ranksheet.keywords k
            LEFT JOIN LATERAL (
              SELECT data_period, updated_at, rows
              FROM ranksheet.rank_sheets
              WHERE keyword_id = k.id
              ORDER BY data_period DESC
              LIMIT 1
            ) s ON true
            WHERE k.category = $1
              AND k.is_active = true
              AND k.indexable = true
              AND k.status = 'ACTIVE'
          )
          SELECT *
          FROM base
          WHERE max_rise IS NOT NULL
            AND max_rise > 0
          ORDER BY max_rise DESC, title ASC
          LIMIT 1
        `,
        [category],
      )
      .then((r) => r.rows[0] ?? null)
      .catch(() => null)

    const mostVolatileRow = await pool
      .query<{
        slug: string
        keyword: string
        title: string
        top_n: string | number | null
        last_refreshed_at: Date | null
        data_period: string | null
        sheet_updated_at: Date | null
        leader: unknown | null
        max_rise: number | null
        volatility: number | null
      }>(
        `
          WITH base AS (
            SELECT
              k.slug,
              k.keyword,
              COALESCE(NULLIF(k.title, ''), k.keyword) AS title,
              k.top_n::text AS top_n,
              k.last_refreshed_at,
              s.data_period,
              s.updated_at AS sheet_updated_at,
              (s.rows -> 0) AS leader,
              CASE
                WHEN s.rows IS NULL THEN NULL
                ELSE (
                  SELECT MAX((elem->>'trendDelta')::int)
                  FROM jsonb_array_elements(s.rows) WITH ORDINALITY AS t(elem, ord)
                  WHERE ord <= 10
                )
              END AS max_rise,
              CASE
                WHEN s.rows IS NULL THEN NULL
                ELSE (
                  SELECT AVG(ABS((elem->>'trendDelta')::int))
                  FROM jsonb_array_elements(s.rows) WITH ORDINALITY AS t(elem, ord)
                  WHERE ord <= 10
                )
              END AS volatility
            FROM ranksheet.keywords k
            LEFT JOIN LATERAL (
              SELECT data_period, updated_at, rows
              FROM ranksheet.rank_sheets
              WHERE keyword_id = k.id
              ORDER BY data_period DESC
              LIMIT 1
            ) s ON true
            WHERE k.category = $1
              AND k.is_active = true
              AND k.indexable = true
              AND k.status = 'ACTIVE'
          )
          SELECT *
          FROM base
          WHERE volatility IS NOT NULL
          ORDER BY volatility DESC, title ASC
          LIMIT 1
        `,
        [category],
      )
      .then((r) => r.rows[0] ?? null)
      .catch(() => null)

    topGainer = topGainerRow
      ? {
          slug: topGainerRow.slug,
          keyword: topGainerRow.keyword,
          title: topGainerRow.title,
          topN: topGainerRow.top_n == null ? undefined : Number.parseInt(String(topGainerRow.top_n), 10) || undefined,
          lastRefreshedAt: toIso(topGainerRow.last_refreshed_at),
          dataPeriod: topGainerRow.data_period ?? null,
          updatedAt: toIso(topGainerRow.sheet_updated_at),
          leader: (topGainerRow.leader as unknown) ?? null,
          maxRise:
            typeof topGainerRow.max_rise === 'number' && Number.isFinite(topGainerRow.max_rise) ? Math.trunc(topGainerRow.max_rise) : null,
          volatility:
            typeof topGainerRow.volatility === 'number' && Number.isFinite(topGainerRow.volatility) ? topGainerRow.volatility : null,
        }
      : null

    mostVolatile = mostVolatileRow
      ? {
          slug: mostVolatileRow.slug,
          keyword: mostVolatileRow.keyword,
          title: mostVolatileRow.title,
          topN: mostVolatileRow.top_n == null ? undefined : Number.parseInt(String(mostVolatileRow.top_n), 10) || undefined,
          lastRefreshedAt: toIso(mostVolatileRow.last_refreshed_at),
          dataPeriod: mostVolatileRow.data_period ?? null,
          updatedAt: toIso(mostVolatileRow.sheet_updated_at),
          leader: (mostVolatileRow.leader as unknown) ?? null,
          maxRise:
            typeof mostVolatileRow.max_rise === 'number' && Number.isFinite(mostVolatileRow.max_rise) ? Math.trunc(mostVolatileRow.max_rise) : null,
          volatility:
            typeof mostVolatileRow.volatility === 'number' && Number.isFinite(mostVolatileRow.volatility) ? mostVolatileRow.volatility : null,
        }
      : null
  }

  const response = {
    ok: true,
    category,
    tracking,
    tickers,
    ...(offset === 0 ? { topGainer, mostVolatile } : {}),
  }

  const parsed = PublicCategoryTickersResponseSchema.safeParse(response)
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_shape' }, { status: 500 })

  return NextResponse.json(parsed.data, {
    headers: {
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
