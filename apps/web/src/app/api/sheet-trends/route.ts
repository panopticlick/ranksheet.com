import { NextResponse } from 'next/server'
import { z } from 'zod'

import { PublicSheetMiniTrendsResponseSchema, PublicSheetTrendsResponseSchema } from '@ranksheet/shared'

import { env } from '@/lib/env'
import { fetchJson } from '@/lib/http/fetchJson'

const SlugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

const SingleQuerySchema = z.object({
  slug: SlugSchema,
  periods: z.coerce.number().int().min(2).max(24).optional(),
  top: z.coerce.number().int().min(3).max(20).optional(),
  asOf: z.string().regex(/^\d{4}-\d{2}(?:-\d{2})?$/).optional(),
})

const MAX_BATCH_SLUGS = 12

const BatchQuerySchema = z.object({
  slugs: z.preprocess(
    (value) => {
      if (typeof value !== 'string') return []
      return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    },
    z.array(SlugSchema).min(1).max(MAX_BATCH_SLUGS),
  ),
  periods: z.coerce.number().int().min(2).max(24).optional(),
  top: z.coerce.number().int().min(3).max(20).optional(),
  asOf: z.string().regex(/^\d{4}-\d{2}(?:-\d{2})?$/).optional(),
})

type NextFetchOptions = RequestInit & { next?: { revalidate?: number } }

type TrendsQuery = {
  periods?: number
  top?: number
  asOf?: string
}

function buildUpstreamUrl(slug: string, query: TrendsQuery): string {
  const upstream = new URL(`${env.CMS_PUBLIC_URL}/api/public/sheets/${encodeURIComponent(slug)}/trends`)
  if (typeof query.periods === 'number') upstream.searchParams.set('periods', String(query.periods))
  if (typeof query.top === 'number') upstream.searchParams.set('top', String(query.top))
  if (query.asOf) upstream.searchParams.set('asOf', query.asOf)
  return upstream.toString()
}

async function fetchSheetTrends(slug: string, query: TrendsQuery): Promise<z.infer<typeof PublicSheetTrendsResponseSchema> | null> {
  const json = await fetchJson<unknown>(buildUpstreamUrl(slug, query), {
    ...(process.env.NODE_ENV === 'production'
      ? ({ next: { revalidate: 600 } } satisfies NextFetchOptions)
      : {}),
    timeoutMs: 15_000,
  }).catch(() => null)

  const parsedJson = PublicSheetTrendsResponseSchema.safeParse(json)
  return parsedJson.success ? parsedJson.data : null
}

export async function GET(request: Request) {
  const url = new URL(request.url)

  const slugsParam = url.searchParams.get('slugs')
  if (slugsParam) {
    const parsed = BatchQuerySchema.safeParse({
      slugs: slugsParam,
      periods: url.searchParams.get('periods') ?? undefined,
      top: url.searchParams.get('top') ?? undefined,
      asOf: url.searchParams.get('asOf') ?? undefined,
    })
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 })

    const uniqueSlugs = Array.from(new Set(parsed.data.slugs)).slice(0, MAX_BATCH_SLUGS)
    const query: TrendsQuery = {
      periods: parsed.data.periods ?? 8,
      top: parsed.data.top ?? 3,
      asOf: parsed.data.asOf,
    }

    const results = await Promise.all(
      uniqueSlugs.map(async (slug) => {
        const trends = await fetchSheetTrends(slug, query)
        const leader = trends?.series?.[0] ?? null
        return {
          slug,
          asin: leader?.asin ?? null,
          points: leader?.points ?? [],
        }
      }),
    )

    const response = { ok: true, items: results }
    const parsedResponse = PublicSheetMiniTrendsResponseSchema.safeParse(response)
    if (!parsedResponse.success) return NextResponse.json({ ok: false, error: 'invalid_shape' }, { status: 500 })

    const hasMissing = results.some((r) => r.points.length === 0)

    return NextResponse.json(parsedResponse.data, {
      headers: {
        'Cache-Control': hasMissing
          ? 'public, s-maxage=300, stale-while-revalidate=3600'
          : 'public, s-maxage=600, stale-while-revalidate=3600',
      },
    })
  }

  const parsed = SingleQuerySchema.safeParse({
    slug: url.searchParams.get('slug') ?? '',
    periods: url.searchParams.get('periods') ?? undefined,
    top: url.searchParams.get('top') ?? undefined,
    asOf: url.searchParams.get('asOf') ?? undefined,
  })
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 })

  const trends = await fetchSheetTrends(parsed.data.slug, parsed.data)
  if (!trends) {
    return NextResponse.json(
      { ok: false, error: 'upstream_failed' },
      { status: 502, headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=600' } },
    )
  }

  return NextResponse.json(trends, {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' },
  })
}
