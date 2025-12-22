import { NextResponse } from 'next/server'
import { z } from 'zod'

import { env } from '@/lib/env'
import { fetchJson } from '@/lib/http/fetchJson'

const CategorySchema = z.enum(['electronics', 'home', 'sports', 'health', 'toys', 'automotive', 'office', 'other'])

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).optional(),
})

const CreateSchema = z.object({
  keyword: z.string().min(2).max(200),
  category: CategorySchema.optional(),
  email: z.string().email().max(200).optional(),
  note: z.string().max(2000).optional(),
})

function forwardClientHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {}
  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) headers['cf-connecting-ip'] = cfIp
  const xff = request.headers.get('x-forwarded-for')
  if (!cfIp && xff) headers['x-forwarded-for'] = xff
  const ua = request.headers.get('user-agent')
  if (ua) headers['user-agent'] = ua
  return headers
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  })
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 })

  const upstream = new URL(`${env.CMS_PUBLIC_URL}/api/public/keyword-requests`)
  if (typeof parsed.data.limit === 'number') upstream.searchParams.set('limit', String(parsed.data.limit))
  if (typeof parsed.data.offset === 'number') upstream.searchParams.set('offset', String(parsed.data.offset))

  const json = await fetchJson<unknown>(upstream.toString(), {
    headers: forwardClientHeaders(request),
    timeoutMs: 12_000,
  }).catch(() => null)

  if (!json) {
    return NextResponse.json(
      { ok: false, error: 'upstream_failed' },
      { status: 502, headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=300' } },
    )
  }

  return NextResponse.json(json, {
    headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=600' },
  })
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })

  const upstream = `${env.CMS_PUBLIC_URL}/api/public/keyword-requests`
  const json = await fetchJson<unknown>(upstream, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...forwardClientHeaders(request) },
    body: JSON.stringify(parsed.data),
    timeoutMs: 15_000,
  }).catch(() => null)

  if (!json) return NextResponse.json({ ok: false, error: 'upstream_failed' }, { status: 502 })
  return NextResponse.json(json, { headers: { 'Cache-Control': 'no-store' } })
}

