import { NextResponse } from 'next/server'
import { z } from 'zod'

import { env } from '@/lib/env'
import { fetchJson } from '@/lib/http/fetchJson'

const ParamsSchema = z.object({
  id: z.coerce.number().int().min(1),
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

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const parsed = ParamsSchema.safeParse({ id: params.id })
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })

  const upstream = `${env.CMS_PUBLIC_URL}/api/public/keyword-requests/${parsed.data.id}/vote`
  const json = await fetchJson<unknown>(upstream, {
    method: 'POST',
    headers: forwardClientHeaders(request),
    timeoutMs: 15_000,
  }).catch(() => null)

  if (!json) return NextResponse.json({ ok: false, error: 'upstream_failed' }, { status: 502 })
  return NextResponse.json(json, { headers: { 'Cache-Control': 'no-store' } })
}

