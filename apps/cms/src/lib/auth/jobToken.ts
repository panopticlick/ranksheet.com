import crypto from 'node:crypto'

import { NextResponse } from 'next/server'

import { env } from '@/lib/env'
import { getClientIp } from '@/lib/security/ip'

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return crypto.timingSafeEqual(aBuf, bBuf)
}

function isIpAllowed(ip: string | null): boolean {
  const raw = env.ADMIN_IP_WHITELIST.trim()
  if (!raw) return true
  if (!ip) return false

  const allowed = new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )

  return allowed.has(ip)
}

function getBearerToken(request: Request): string {
  const auth = request.headers.get('authorization') || ''
  const match = auth.match(/^Bearer\s+(.+)$/i)
  if (match?.[1]) return match[1].trim()
  return ''
}

export function requireJobAuth(request: Request): NextResponse | null {
  const token = getBearerToken(request) || request.headers.get('x-job-token') || ''
  if (!env.JOB_TOKEN || !token || !safeEqual(token, env.JOB_TOKEN)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const ip = getClientIp(request)
  if (!isIpAllowed(ip)) {
    return NextResponse.json({ ok: false, error: 'ip_not_allowed' }, { status: 403 })
  }

  return null
}
