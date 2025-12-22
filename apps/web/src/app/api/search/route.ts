import { NextResponse } from 'next/server'
import { z } from 'zod'

import { searchPublicKeywords } from '@/lib/cms/public'

const QuerySchema = z.object({
  q: z.string().min(2).max(80),
  category: z.string().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(30).optional(),
})

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    q: url.searchParams.get('q') ?? '',
    category: url.searchParams.get('category') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  })
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 })

  const data = await searchPublicKeywords(
    { q: parsed.data.q, category: parsed.data.category, limit: parsed.data.limit },
    { revalidateSeconds: 60 },
  )

  return NextResponse.json(data, { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=600' } })
}

