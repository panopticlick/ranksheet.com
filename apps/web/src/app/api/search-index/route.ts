import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getPublicSearchIndex } from '@/lib/cms/public'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(50).max(10_000).optional(),
})

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
  })
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 })

  const data = await getPublicSearchIndex({ limit: parsed.data.limit }, { revalidateSeconds: 21600 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 's-maxage=21600, stale-while-revalidate=86400' } })
}

