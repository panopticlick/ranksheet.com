import { getDbPool } from '@/lib/db/pool'
import { logger } from '@/lib/logger'

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function toSigned32(n: number): number {
  return n | 0
}

export interface AdvisoryLockOptions {
  /**
   * Timeout in milliseconds for acquiring the lock
   * Default: 30000 (30 seconds)
   */
  acquireTimeoutMs?: number

  /**
   * Statement timeout in milliseconds for operations within the lock
   * Default: 300000 (5 minutes)
   * Set to 0 to disable timeout
   */
  statementTimeoutMs?: number
}

/**
 * Execute a function with PostgreSQL advisory lock protection
 *
 * Security enhancements:
 * - Acquire timeout prevents indefinite waiting
 * - Statement timeout prevents operations from running forever
 * - Automatic lock cleanup in finally block
 *
 * @param key - Unique lock key (will be hashed to 32-bit integer)
 * @param fn - Function to execute within lock
 * @param options - Lock configuration options
 * @returns Result with acquisition status and function result
 */
export async function withAdvisoryLock<T>(
  key: string,
  fn: () => Promise<T>,
  options: AdvisoryLockOptions = {}
): Promise<{ acquired: boolean; result?: T }> {
  const { acquireTimeoutMs = 30000, statementTimeoutMs = 300000 } = options

  const pool = getDbPool()
  const lockId = toSigned32(fnv1a32(key))
  const client = await pool.connect()

  try {
    // Set statement timeout for the connection
    if (statementTimeoutMs > 0) {
      await client.query(`SET statement_timeout = ${statementTimeoutMs}`)
    }

    // Try to acquire lock with timeout
    const acquireDeadline = Date.now() + acquireTimeoutMs
    let acquired = false

    while (Date.now() < acquireDeadline) {
      const result = await client.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS acquired',
        [lockId]
      )
      acquired = result.rows[0]?.acquired ?? false

      if (acquired) break

      // Wait 100ms before retrying
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    if (!acquired) {
      logger.warn({ key, lockId, acquireTimeoutMs }, 'advisory_lock_timeout')
      return { acquired: false }
    }

    logger.debug({ key, lockId }, 'advisory_lock_acquired')

    try {
      const result = await fn()
      return { acquired: true, result }
    } finally {
      // Always release the lock
      await client.query('SELECT pg_advisory_unlock($1)', [lockId])
      logger.debug({ key, lockId }, 'advisory_lock_released')
    }
  } finally {
    // Reset statement timeout and release client
    if (statementTimeoutMs > 0) {
      await client.query('RESET statement_timeout').catch(() => {})
    }
    client.release()
  }
}

/**
 * Clean up stale advisory locks (for maintenance/monitoring)
 * This queries for locks held by terminated or idle connections
 *
 * Note: This is informational only. Locks are automatically released
 * when connections close. Use for monitoring/alerting.
 */
export async function getStaleLocks(): Promise<Array<{ lockId: number; pid: number; granted: boolean }>> {
  const pool = getDbPool()

  const result = await pool.query<{ objid: number; pid: number; granted: boolean }>(`
    SELECT
      objid,
      pid,
      granted
    FROM pg_locks
    WHERE locktype = 'advisory'
      AND classid = 0
  `)

  return result.rows.map((r) => ({
    lockId: r.objid,
    pid: r.pid,
    granted: r.granted,
  }))
}

