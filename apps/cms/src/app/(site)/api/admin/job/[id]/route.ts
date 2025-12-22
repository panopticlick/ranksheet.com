import { NextResponse } from 'next/server'

import { requireJobAuth } from '@/lib/auth/jobToken'
import { getJobState } from '@/lib/jobs/jobQueue'
import { enforceRateLimit } from '@/lib/security/rateLimit'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = requireJobAuth(request)
  if (unauthorized) return unauthorized

  const limited = await enforceRateLimit(request, { name: 'admin_job_status', limit: 60, windowSeconds: 60 })
  if (limited) return limited

  const params = await context.params
  const id = params.id.trim()
  const state = await getJobState(id)
  if (!state) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  return NextResponse.json({ ok: true, job: state })
}
