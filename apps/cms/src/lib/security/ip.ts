import crypto from 'node:crypto'

import { env } from '@/lib/env'

export function getClientIp(request: Request): string | null {
  const cf = request.headers.get('cf-connecting-ip')
  if (cf) return cf.trim()

  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()

  const xri = request.headers.get('x-real-ip')
  if (xri) return xri.trim()

  return null
}

export function hashIp(ip: string): string {
  return crypto
    .createHash('sha256')
    .update(env.IP_HASH_SALT)
    .update('|')
    .update(ip)
    .digest('hex')
    .slice(0, 32)
}

