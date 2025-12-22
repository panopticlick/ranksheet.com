import { NextResponse } from 'next/server'

import { requireJobAuth } from '@/lib/auth/jobToken'
import { enqueueRefreshOne } from '@/lib/jobs/jobQueue'
import { enforceRateLimit } from '@/lib/security/rateLimit'
import { withIdempotency } from '@/lib/security/idempotency'

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const unauthorized = requireJobAuth(request)
  if (unauthorized) return unauthorized

  const limited = await enforceRateLimit(request, { name: 'admin_refresh', limit: 30, windowSeconds: 60 })
  if (limited) return limited

  return await withIdempotency(request, async () => {
    const params = await context.params
    const slug = params.slug.trim()
    if (!slug) return NextResponse.json({ ok: false, error: 'invalid_slug' }, { status: 400 })

    const jobId = await enqueueRefreshOne(slug)
    return NextResponse.json({ jobId, status: 'QUEUED', keyword: slug })
  })
}
