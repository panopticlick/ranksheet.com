import { NextResponse } from 'next/server'

import { requireJobAuth } from '@/lib/auth/jobToken'
import { env } from '@/lib/env'
import { fetchJson } from '@/lib/http/fetchJson'

/**
 * Debug endpoint for FastAPI raw reports
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
  return NextResponse.json({ ok: true, url, json })
}

