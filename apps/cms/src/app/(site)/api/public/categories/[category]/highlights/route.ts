import { NextResponse } from 'next/server'
import { z } from 'zod'

import { PublicCategoryHighlightsResponseSchema } from '@ranksheet/shared'

import { getDbPool } from '@/lib/db/pool'
import { enforceRateLimit } from '@/lib/security/rateLimit'

const ParamsSchema = z.object({
  category: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
})

function toIso(value: Date | string | null): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const d = new Date(value)
  return Number.isFinite(d.valueOf()) ? d.toISOString() : null
}

type KeywordRow = {
  slug: string
  keyword: string
  last_refreshed_at: Date | null
}

export async function GET(request: Request, context: { params: Promise<{ category: string }> }) {
  const limited = await enforceRateLimit(request, { name: 'public_category_highlights', limit: 120, windowSeconds: 60 })
  if (limited) return limited

  const params = await context.params
  const parsedParams = ParamsSchema.safeParse({ category: params.category })
  if (!parsedParams.success) return NextResponse.json({ ok: false, error: 'invalid_category' }, { status: 400 })

  const category = parsedParams.data.category
  const pool = getDbPool()

  const [recentRes, hotRes] = await Promise.all([
    pool.query<KeywordRow>(
      `
        SELECT slug, keyword, last_refreshed_at
        FROM ranksheet.keywords
        WHERE category = $1
          AND is_active = true
          AND indexable = true
          AND status = 'ACTIVE'
          AND last_refreshed_at >= NOW() - INTERVAL '7 days'
        ORDER BY last_refreshed_at DESC
        LIMIT 12
      `,
      [category],
    ),
    pool
      .query<{ slug: string; keyword: string; last_refreshed_at: Date | null; clicks: string }>(
        `
          SELECT k.slug, k.keyword, k.last_refreshed_at, COALESCE(SUM(d.clicks), 0)::text AS clicks
          FROM ranksheet.keywords k
          JOIN ranksheet.affiliate_clicks_daily d
            ON d.keyword_slug = k.slug
          WHERE k.category = $1
            AND k.is_active = true
            AND k.indexable = true
            AND k.status = 'ACTIVE'
            AND d.day >= (CURRENT_DATE - INTERVAL '6 days')::date
          GROUP BY k.slug, k.keyword, k.last_refreshed_at
          ORDER BY COALESCE(SUM(d.clicks), 0) DESC
          LIMIT 12
        `,
        [category],
      )
      .catch(() => ({ rows: [] })),
  ])

  const recentlyUpdated = recentRes.rows.slice(0, 6).map((r) => ({
    slug: r.slug,
    keyword: r.keyword,
    lastRefreshedAt: toIso(r.last_refreshed_at),
  }))

  const hotThisWeekBase = hotRes.rows
    .map((r) => ({
      slug: r.slug,
      keyword: r.keyword,
      lastRefreshedAt: toIso(r.last_refreshed_at),
      clicks: Number.parseInt(r.clicks, 10) || 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)

  const hotThisWeek: Array<{ slug: string; keyword: string; lastRefreshedAt: string | null }> = []
  const seen = new Set<string>()
  for (const item of hotThisWeekBase) {
    if (hotThisWeek.length >= 6) break
    if (seen.has(item.slug)) continue
    seen.add(item.slug)
    hotThisWeek.push({ slug: item.slug, keyword: item.keyword, lastRefreshedAt: item.lastRefreshedAt })
  }

  if (hotThisWeek.length < 6) {
    const fallback = await pool
      .query<KeywordRow>(
        `
          SELECT slug, keyword, last_refreshed_at
          FROM ranksheet.keywords
          WHERE category = $1
            AND is_active = true
            AND indexable = true
            AND status = 'ACTIVE'
          ORDER BY priority DESC, COALESCE(last_refreshed_at, '1970-01-01'::timestamptz) DESC
          LIMIT 24
        `,
        [category],
      )
      .catch(() => ({ rows: [] as KeywordRow[] }))

    for (const r of fallback.rows) {
      if (hotThisWeek.length >= 6) break
      if (seen.has(r.slug)) continue
      seen.add(r.slug)
      hotThisWeek.push({ slug: r.slug, keyword: r.keyword, lastRefreshedAt: toIso(r.last_refreshed_at) })
    }
  }

  const response = {
    ok: true,
    category,
    recentlyUpdated,
    hotThisWeek,
  } as const

  const parsed = PublicCategoryHighlightsResponseSchema.safeParse(response)
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_shape' }, { status: 500 })

  return NextResponse.json(parsed.data, {
    headers: {
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  })
}

