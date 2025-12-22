import { NextResponse } from 'next/server'
import { z } from 'zod'

import { amazonProductUrl } from '@/lib/amazon/url'
import { env } from '@/lib/env'

const ParamsSchema = z.object({
  asin: z
    .string()
    .min(10)
    .max(20)
    .transform((s) => s.trim().toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{10}$/)),
})

const QuerySchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  rank: z.coerce.number().int().min(1).max(10_000).optional(),
  pos: z.string().min(1).max(50).optional(),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(150).optional(),
})

async function trackClick(args: {
  request: Request
  slug: string
  asin: string
  rank?: number
  position?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
}): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 900)

  const forwarded: Record<string, string> = {}
  const cfIp = args.request.headers.get('cf-connecting-ip')
  if (cfIp) forwarded['cf-connecting-ip'] = cfIp
  const xff = args.request.headers.get('x-forwarded-for')
  if (!cfIp && xff) forwarded['x-forwarded-for'] = xff
  const ua = args.request.headers.get('user-agent')
  if (ua) forwarded['user-agent'] = ua

  try {
    await fetch(`${env.CMS_PUBLIC_URL}/api/public/click`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', ...forwarded },
      body: JSON.stringify({
        slug: args.slug,
        asin: args.asin,
        rank: args.rank,
        position: args.position,
        referrer: args.request.headers.get('referer') ?? undefined,
        utmSource: args.utmSource,
        utmMedium: args.utmMedium,
        utmCampaign: args.utmCampaign,
      }),
    })
  } catch {
    // ignore
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET(request: Request, context: { params: Promise<{ asin: string }> }) {
  const params = await context.params
  const parsedParams = ParamsSchema.safeParse({ asin: params.asin })
  if (!parsedParams.success) {
    return NextResponse.json({ ok: false, error: 'invalid_asin' }, { status: 400 })
  }

  const url = new URL(request.url)
  const parsedQuery = QuerySchema.safeParse({
    slug: url.searchParams.get('slug') ?? '',
    rank: url.searchParams.get('rank') ?? undefined,
    pos: url.searchParams.get('pos') ?? undefined,
    utm_source: url.searchParams.get('utm_source') ?? undefined,
    utm_medium: url.searchParams.get('utm_medium') ?? undefined,
    utm_campaign: url.searchParams.get('utm_campaign') ?? undefined,
  })

  if (!parsedQuery.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_query' },
      { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  }

  const asin = parsedParams.data.asin
  const slug = parsedQuery.data.slug

  await trackClick({
    request,
    slug,
    asin,
    rank: parsedQuery.data.rank,
    position: parsedQuery.data.pos,
    utmSource: parsedQuery.data.utm_source,
    utmMedium: parsedQuery.data.utm_medium,
    utmCampaign: parsedQuery.data.utm_campaign,
  })

  const destination = amazonProductUrl({ asin, tag: env.AMAZON_ASSOCIATE_TAG })

  const res = NextResponse.redirect(destination, 302)
  res.headers.set('Cache-Control', 'no-store, max-age=0')
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}
