import { NextResponse } from 'next/server'
import { z } from 'zod'

import { PublicSearchIndexResponseSchema } from '@ranksheet/shared'

import { getDbPool } from '@/lib/db/pool'
import { enforceRateLimit } from '@/lib/security/rateLimit'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(50).max(10_000).optional(),
})

export async function GET(request: Request) {
  const limited = await enforceRateLimit(request, { name: 'public_search_index', limit: 30, windowSeconds: 60 })
  if (limited) return limited

  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
  })
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 })

  const limit = parsed.data.limit ?? 5000

  const pool = getDbPool()
  const res = await pool.query<{
    slug: string
    title: string
  }>(
    `
      SELECT
        slug,
        COALESCE(NULLIF(title, ''), keyword) AS title
      FROM ranksheet.keywords
      WHERE is_active = true
        AND indexable = true
        AND status = 'ACTIVE'
      ORDER BY
        priority DESC NULLS LAST,
        last_refreshed_at DESC NULLS LAST,
        keyword ASC
      LIMIT $1
    `,
    [limit],
  )

  const response = {
    ok: true,
    items: res.rows.map((r) => ({ slug: r.slug, title: r.title })),
  }

  const validated = PublicSearchIndexResponseSchema.safeParse(response)
  if (!validated.success) return NextResponse.json({ ok: false, error: 'invalid_shape' }, { status: 500 })

  return NextResponse.json(validated.data, {
    headers: { 'Cache-Control': 's-maxage=21600, stale-while-revalidate=86400' },
  })
}

