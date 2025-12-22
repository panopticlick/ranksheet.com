import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getDbPool } from '@/lib/db/pool'
import { enforceRateLimit } from '@/lib/security/rateLimit'
import { getClientIp, hashIp } from '@/lib/security/ip'

const BodySchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  asin: z
    .string()
    .min(10)
    .max(20)
    .transform((s) => s.trim().toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{10}$/)),
  rank: z.number().int().min(1).max(10_000).optional(),
  position: z.string().min(1).max(50).optional(),
  referrer: z.string().max(1024).optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(150).optional(),
})

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, { name: 'public_click', limit: 180, windowSeconds: 60 })
  if (limited) return limited

  const body = (await request.json().catch(() => null)) as unknown
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })

  const ip = getClientIp(request)
  const userIpHash = ip ? hashIp(ip) : null

  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null
  const headerReferrer = request.headers.get('referer')?.slice(0, 1024) ?? null
  const referrer = (parsed.data.referrer ?? headerReferrer)?.slice(0, 1024) ?? null

  const pool = getDbPool()
  await pool.query(
    `
      INSERT INTO ranksheet.affiliate_clicks (
        keyword_slug,
        asin,
        rank,
        position_context,
        user_ip_hash,
        user_agent,
        referrer_url,
        utm_source,
        utm_medium,
        utm_campaign
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
    [
      parsed.data.slug,
      parsed.data.asin,
      parsed.data.rank ?? null,
      parsed.data.position ?? null,
      userIpHash,
      userAgent,
      referrer,
      parsed.data.utmSource ?? null,
      parsed.data.utmMedium ?? null,
      parsed.data.utmCampaign ?? null,
    ],
  )

  const day = new Date().toISOString().slice(0, 10)
  await pool.query(
    `
      INSERT INTO ranksheet.affiliate_clicks_daily (day, keyword_slug, asin, clicks)
      VALUES ($1::date, $2, $3, 1)
      ON CONFLICT (day, keyword_slug, asin)
      DO UPDATE SET clicks = ranksheet.affiliate_clicks_daily.clicks + 1
    `,
    [day, parsed.data.slug, parsed.data.asin],
  )

  return NextResponse.json({ ok: true })
}

