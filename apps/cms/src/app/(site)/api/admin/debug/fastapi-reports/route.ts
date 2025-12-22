import { NextResponse } from 'next/server'

import { requireJobAuth } from '@/lib/auth/jobToken'
import { env } from '@/lib/env'
import { getWeeklyReportDates } from '@/lib/amzapi/fastapi'

/**
 * Debug endpoint for FastAPI weekly report dates
 * Disabled in production for security
 */
export async function GET(request: Request) {
  // Disable in production
  if (env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const unauthorized = requireJobAuth(request)
  if (unauthorized) return unauthorized

  try {
    const dates = await getWeeklyReportDates({ limit: 5, cacheTtlSeconds: 1 })
    return NextResponse.json({ ok: true, dates })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    )
  }
}

