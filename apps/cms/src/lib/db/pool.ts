import { Pool } from 'pg'

import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

declare global {
  var __rsDbPool: Pool | undefined
}

export function getDbPool(): Pool {
  if (globalThis.__rsDbPool) return globalThis.__rsDbPool

  const config = {
    connectionString: env.DATABASE_URI,

    // Connection pool sizing
    max: env.NODE_ENV === 'production' ? 20 : 10,
    min: env.NODE_ENV === 'production' ? 2 : 1,

    // Timeouts
    idleTimeoutMillis: 30_000, // 30 seconds before closing idle connection
    connectionTimeoutMillis: 10_000, // 10 seconds to acquire connection

    // Statement timeout (prevent long-running queries)
    statement_timeout: env.NODE_ENV === 'production' ? 30000 : 60000,

    // Connection keep-alive
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,

    // Application name for monitoring
    application_name: 'ranksheet-cms',
  }

  globalThis.__rsDbPool = new Pool(config)

  // Error handling
  globalThis.__rsDbPool.on('error', (error, _client) => {
    logger.error({ error }, 'postgres_pool_error')
  })

  // Connection monitoring
  globalThis.__rsDbPool.on('connect', () => {
    logger.debug('postgres_pool_client_connected')
  })

  globalThis.__rsDbPool.on('acquire', () => {
    logger.debug('postgres_pool_client_acquired')
  })

  globalThis.__rsDbPool.on('remove', () => {
    logger.debug('postgres_pool_client_removed')
  })

  logger.info(
    {
      max: config.max,
      min: config.min,
      connectionTimeout: config.connectionTimeoutMillis,
      idleTimeout: config.idleTimeoutMillis,
    },
    'postgres_pool_initialized',
  )

  return globalThis.__rsDbPool
}

/**
 * Get current pool statistics
 */
export function getPoolStats() {
  const pool = globalThis.__rsDbPool
  if (!pool) {
    return { totalCount: 0, idleCount: 0, waitingCount: 0, initialized: false }
  }

  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    initialized: true,
  }
}

/**
 * Graceful shutdown: drain and close pool
 */
export async function closeDbPool() {
  if (globalThis.__rsDbPool) {
    logger.info('closing_postgres_pool')
    await globalThis.__rsDbPool.end()
    globalThis.__rsDbPool = undefined
    logger.info('postgres_pool_closed')
  }
}
