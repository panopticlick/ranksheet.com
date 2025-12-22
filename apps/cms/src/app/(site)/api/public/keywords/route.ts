import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Where } from 'payload'

import { getPayloadClient } from '@/lib/payload/client'
import { enforceRateLimit } from '@/lib/security/rateLimit'
import type { Keyword } from '@/payload-types'

const QuerySchema = z.object({
  category: z.string().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).max(5000).optional(),
})

export async function GET(request: Request) {
  const limited = await enforceRateLimit(request, { name: 'public_keywords', limit: 60, windowSeconds: 60 })
  if (limited) return limited

  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    category: url.searchParams.get('category') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  })
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 })

  const payload = await getPayloadClient()

  const where: Where = {
    and: [
      { isActive: { equals: true } },
      { indexable: { equals: true } },
      { status: { equals: 'ACTIVE' } },
    ],
  }
  if (parsed.data.category) {
    where.and?.push({ category: { equals: parsed.data.category } })
  }

  const limit = parsed.data.limit ?? 200
  const offset = parsed.data.offset ?? 0

  const res = await payload.find({
    collection: 'keywords',
    where,
    limit,
    pagination: true,
    page: Math.floor(offset / limit) + 1,
    sort: '-priority',
    overrideAccess: true,
    depth: 0,
  })

  const keywords = (res.docs as Keyword[]).map((k) => ({
    slug: k.slug,
    keyword: k.keyword,
    category: k.category ?? null,
    indexable: !!k.indexable,
    lastRefreshedAt: k.lastRefreshedAt ?? null,
  }))

  return NextResponse.json(
    {
      keywords,
      total: res.totalDocs ?? keywords.length,
    },
    {
      headers: {
        'Cache-Control': 's-maxage=21600, stale-while-revalidate=86400',
      },
    },
  )
}
