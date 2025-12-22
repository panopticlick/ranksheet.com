import Redis from 'ioredis'

import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

declare global {
  var __rsRedis: Redis | undefined
  var __rsRedisEventsAttached: boolean | undefined
}

export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null
  if (globalThis.__rsRedis) return globalThis.__rsRedis

  globalThis.__rsRedis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableReadyCheck: true,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000)
      if (times <= 3) logger.warn({ attempt: times, delay_ms: delay }, 'redis_retry')
      return delay
    },
  })

  if (!globalThis.__rsRedisEventsAttached) {
    globalThis.__rsRedisEventsAttached = true
    globalThis.__rsRedis.on('connect', () => logger.info('redis_connected'))
    globalThis.__rsRedis.on('ready', () => logger.info('redis_ready'))
    globalThis.__rsRedis.on('error', (error) => logger.error({ error }, 'redis_error'))
    globalThis.__rsRedis.on('close', () => logger.warn('redis_closed'))
    globalThis.__rsRedis.on('reconnecting', () => logger.info('redis_reconnecting'))
  }

  return globalThis.__rsRedis
}
