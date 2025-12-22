import { NextResponse } from 'next/server'
import { z } from 'zod'

import { slugify } from '@ranksheet/shared'

import { getDbPool } from '@/lib/db/pool'
import { getPayloadClient } from '@/lib/payload/client'
import { enforceRateLimit } from '@/lib/security/rateLimit'
import { getClientIp, hashIp } from '@/lib/security/ip'

const CategorySchema = z.enum(['electronics', 'home', 'sports', 'health', 'toys', 'automotive', 'office', 'other'])

const BodySchema = z.object({
  keyword: z.string().min(2).max(200),
  category: CategorySchema.optional(),
  email: z.string().email().max(200).optional(),
  note: z.string().max(2000).optional(),
})

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).optional(),
})

export async function GET(request: Request) {
  const limited = await enforceRateLimit(request, { name: 'public_keyword_requests_list', limit: 60, windowSeconds: 60 })
  if (limited) return limited

  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  })
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 })

  const limit = parsed.data.limit ?? 30
  const offset = parsed.data.offset ?? 0

  const pool = getDbPool()
  const res = await pool.query<{
    id: number
    slug: string
    keyword: string
    category: string | null
    votes: number | null
    created_at: Date
    updated_at: Date
  }>(
    `
      SELECT id, slug, keyword, category::text AS category, votes::int AS votes, created_at, updated_at
      FROM ranksheet.keyword_requests
      ORDER BY votes DESC NULLS LAST, created_at DESC
      LIMIT $1 OFFSET $2
    `,
    [limit, offset],
  )

  const totalRes = await pool.query<{ total: string }>(
    `
      SELECT COUNT(*)::text AS total
      FROM ranksheet.keyword_requests
    `,
  )

  const total = Number.parseInt(totalRes.rows[0]?.total ?? '0', 10)

  return NextResponse.json(
    {
      ok: true,
      items: res.rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        keyword: r.keyword,
        category: r.category,
        votes: r.votes ?? 0,
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
      })),
      total,
    },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=3600' } },
  )
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, { name: 'public_keyword_request', limit: 10, windowSeconds: 3600 })
  if (limited) return limited

  const body = (await request.json().catch(() => null)) as unknown
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })

  const keyword = parsed.data.keyword.trim()
  const slug = slugify(keyword)

  const payload = await getPayloadClient()
  const existing = await payload.find({
    collection: 'keyword-requests',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })

  let requestId: number
  if (existing.docs.length > 0) {
    requestId = (existing.docs[0] as { id: number }).id
  } else {
    const created = await payload.create({
      collection: 'keyword-requests',
      draft: false,
      data: {
        slug,
        keyword,
        ...(parsed.data.category ? { category: parsed.data.category } : {}),
        ...(parsed.data.email ? { email: parsed.data.email } : {}),
        ...(parsed.data.note ? { note: parsed.data.note } : {}),
        status: 'NEW',
        votes: 0,
      },
      overrideAccess: true,
    })
    requestId = (created as { id: number }).id
  }

  const ip = getClientIp(request)
  if (!ip) {
    return NextResponse.json({ ok: true, requestId, voted: false })
  }
  const ipHash = hashIp(ip)
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null

  const pool = getDbPool()
  const inserted = await pool.query<{ request_id: number }>(
    `
      INSERT INTO ranksheet.keyword_request_votes (request_id, user_ip_hash, user_agent)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
      RETURNING request_id
    `,
    [requestId, ipHash, userAgent],
  )

  const voted = inserted.rows.length > 0

  let votes = 0
  if (voted) {
    const updated = await pool.query<{ votes: number }>(
      `
        UPDATE ranksheet.keyword_requests
        SET votes = COALESCE(votes, 0) + 1,
            last_voted_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING votes::int AS votes
      `,
      [requestId],
    )
    votes = updated.rows[0]?.votes ?? 0
  } else {
    const current = await pool.query<{ votes: number }>(
      `
        SELECT votes::int AS votes
        FROM ranksheet.keyword_requests
        WHERE id = $1
        LIMIT 1
      `,
      [requestId],
    )
    votes = current.rows[0]?.votes ?? 0
  }

  return NextResponse.json({
    ok: true,
    requestId,
    slug,
    voted,
    votes,
  })
}
