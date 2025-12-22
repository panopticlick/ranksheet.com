import { NextResponse } from 'next/server'

import { z } from 'zod'

import { requireJobAuth } from '@/lib/auth/jobToken'
import { enqueueRefreshAll } from '@/lib/jobs/jobQueue'
import { getPayloadClient } from '@/lib/payload/client'
import { enforceRateLimit } from '@/lib/security/rateLimit'
import { withIdempotency } from '@/lib/security/idempotency'

const BodySchema = z.object({
  concurrency: z.number().int().min(1).max(10).optional(),
  limit: z.number().int().min(1).max(2000).optional(),
})

export async function POST(request: Request) {
  const unauthorized = requireJobAuth(request)
  if (unauthorized) return unauthorized

  const limited = await enforceRateLimit(request, { name: 'admin_refresh_all', limit: 10, windowSeconds: 60 })
  if (limited) return limited

  return await withIdempotency(request, async () => {
    const json = await request.json().catch(() => ({}))
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })

    const concurrency = parsed.data.concurrency ?? 3
    const limit = parsed.data.limit

    const payload = await getPayloadClient()
    const countRes = await payload.count({
      collection: 'keywords',
      where: { isActive: { equals: true } },
      overrideAccess: true,
    })

    const jobId = await enqueueRefreshAll({ concurrency, limit })

    return NextResponse.json({
      jobId,
      status: 'QUEUED',
      keywordsCount: countRes.totalDocs ?? 0,
    })
  })
}
