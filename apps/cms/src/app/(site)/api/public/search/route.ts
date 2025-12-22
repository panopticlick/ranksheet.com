import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getDbPool } from '@/lib/db/pool'
import { enforceRateLimit } from '@/lib/security/rateLimit'

const QuerySchema = z.object({
  q: z.string().min(2).max(80),
  category: z.string().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(30).optional(),
})

export async function GET(request: Request) {
  const limited = await enforceRateLimit(request, { name: 'public_search', limit: 120, windowSeconds: 60 })
  if (limited) return limited

  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    q: url.searchParams.get('q') ?? '',
    category: url.searchParams.get('category') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  })
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 })

  const q = parsed.data.q.trim()
  const limit = parsed.data.limit ?? 12

  const pool = getDbPool()
  const params: unknown[] = [`%${q}%`, `${q}%`, limit]
  let whereCategory = ''
  if (parsed.data.category) {
    whereCategory = 'AND category::text = $4'
    params.push(parsed.data.category)
  }

  const res = await pool.query<{
    slug: string
    keyword: string
    category: string | null
    last_refreshed_at: Date | null
    priority: number | null
  }>(
    `
      SELECT slug, keyword, category::text AS category, last_refreshed_at, priority::int AS priority
      FROM ranksheet.keywords
      WHERE is_active = true
        AND indexable = true
        AND status = 'ACTIVE'
        AND (
          keyword ILIKE $1
          OR slug ILIKE $1
          OR keyword ILIKE $2
          OR slug ILIKE $2
        )
        ${whereCategory}
      ORDER BY
        CASE
          WHEN keyword ILIKE $2 THEN 0
          WHEN slug ILIKE $2 THEN 1
          ELSE 2
        END,
        priority DESC NULLS LAST,
        last_refreshed_at DESC NULLS LAST,
        keyword ASC
      LIMIT $3
    `,
    params,
  )

  return NextResponse.json(
    {
      ok: true,
      q,
      items: res.rows.map((r) => ({
        slug: r.slug,
        keyword: r.keyword,
        category: r.category,
        lastRefreshedAt: r.last_refreshed_at ? r.last_refreshed_at.toISOString() : null,
      })),
    },
    { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=600' } },
  )
}

