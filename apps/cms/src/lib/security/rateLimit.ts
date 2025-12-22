import { NextResponse } from 'next/server'

import { getRedis } from '@/lib/redis/client'
import { getClientIp, hashIp } from '@/lib/security/ip'

export type RateLimitConfig = {
  name: string
  limit: number
  windowSeconds: number
}

export async function enforceRateLimit(request: Request, cfg: RateLimitConfig): Promise<NextResponse | null> {
  const redis = getRedis()
  if (!redis) return null

  const ip = getClientIp(request)
  if (!ip) return null

  const key = `rs:rl:${cfg.name}:${hashIp(ip)}`
  const tx = redis.multi()
  tx.incr(key)
  tx.ttl(key)
  const [incrRes, ttlRes] = (await tx.exec()) ?? []

  const count = typeof incrRes?.[1] === 'number' ? incrRes[1] : 0
  let ttl = typeof ttlRes?.[1] === 'number' ? ttlRes[1] : -1

  if (ttl < 0) {
    await redis.expire(key, cfg.windowSeconds)
    ttl = cfg.windowSeconds
  }

  if (count > cfg.limit) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.max(1, ttl)),
        },
      },
    )
  }

  return null
}

