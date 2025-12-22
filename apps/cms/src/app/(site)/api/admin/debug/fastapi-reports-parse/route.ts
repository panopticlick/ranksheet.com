import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireJobAuth } from '@/lib/auth/jobToken'
import { env } from '@/lib/env'
import { fetchJson } from '@/lib/http/fetchJson'

const ReportSchema = z
  .object({
    reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodType: z.string(),
  })
  .passthrough()

const ReportsResponseSchema = z
  .object({
    items: z.array(ReportSchema),
    total: z.number().optional(),
  })
  .passthrough()

/**
 * Debug endpoint for FastAPI reports with Zod parsing
 * Disabled in production for security
 */
export async function GET(request: Request) {
  // Disable in production
  if (env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const unauthorized = requireJobAuth(request)
  if (unauthorized) return unauthorized

  const url = `${env.FASTAPI_URL}/reports/?period_type=WEEK&limit=2`
  const json = await fetchJson<unknown>(url, { headers: { 'X-API-Key': env.FASTAPI_KEY ?? '' }, timeoutMs: 20_000 })

  const parsed = ReportsResponseSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'zod_failed', issues: parsed.error.issues, received: json },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, dates: parsed.data.items.map((i) => i.reportDate) })
}
