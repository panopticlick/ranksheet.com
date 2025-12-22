import { getDbPool } from '@/lib/db/pool'
import { logger } from '@/lib/logger'
import type { PoolClient } from 'pg'

/**
 * Transaction context passed to callback functions
 * Note: Payload CMS operations cannot participate in manual transactions
 * as Payload manages its own connection pooling. Use this for coordinating
 * direct SQL operations only.
 */
export interface TransactionContext {
  client: PoolClient
}

/**
 * Execute a function within a PostgreSQL transaction
 *
 * Usage:
 * ```typescript
 * await withTransaction(async (ctx) => {
 *   await ctx.client.query('UPDATE table1 SET ...')
 *   await ctx.client.query('INSERT INTO table2 ...')
 * })
 * ```
 *
 * Important limitations:
 * - Payload CMS operations (payload.create/update) use their own connections
 * - They will NOT participate in this transaction
 * - For atomic Payload operations, use application-level locking (advisory locks)
 *
 * @param fn - Async function to execute within transaction
 * @returns Result from the function
 */
export async function withTransaction<T>(
  fn: (ctx: TransactionContext) => Promise<T>
): Promise<T> {
  const pool = getDbPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    logger.debug('transaction_begin')

    const result = await fn({ client })

    await client.query('COMMIT')
    logger.debug('transaction_commit')

    return result
  } catch (err) {
    await client.query('ROLLBACK')
    logger.error({ err }, 'transaction_rollback')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Wrapper for operations that need both advisory lock and transaction protection
 *
 * Note: Since Payload operations cannot participate in manual transactions,
 * this function provides:
 * 1. Advisory lock to prevent concurrent access
 * 2. Transaction for any direct SQL operations
 * 3. Payload operations still use separate connections
 *
 * For true atomic updates across Payload collections, coordinate at application
 * level using locks and compensating actions on failure.
 */
export async function withLockedTransaction<T>(
  lockKey: string,
  fn: (ctx: TransactionContext) => Promise<T>
): Promise<{ acquired: boolean; result?: T }> {
  const pool = getDbPool()

  // Hash lock key to 32-bit integer
  function fnv1a32(input: string): number {
    let hash = 0x811c9dc5
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193)
    }
    return hash >>> 0
  }

  const lockId = (fnv1a32(lockKey) | 0) // Convert to signed 32-bit

  // Try to acquire advisory lock
  const lockResult = await pool.query<{ acquired: boolean }>(
    'SELECT pg_try_advisory_lock($1) AS acquired',
    [lockId]
  )

  if (!lockResult.rows[0]?.acquired) {
    logger.warn({ lockKey, lockId }, 'advisory_lock_not_acquired')
    return { acquired: false }
  }

  try {
    // Execute function within transaction
    const result = await withTransaction(fn)
    return { acquired: true, result }
  } finally {
    // Always release advisory lock
    await pool.query('SELECT pg_advisory_unlock($1)', [lockId])
    logger.debug({ lockKey, lockId }, 'advisory_lock_released')
  }
}
