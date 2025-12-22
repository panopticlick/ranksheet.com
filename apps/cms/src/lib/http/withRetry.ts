/**
 * Resilient HTTP retry mechanism with exponential backoff and jitter
 *
 * Features:
 * - Exponential backoff (initial 100ms, max 10s)
 * - Random jitter to prevent thundering herd
 * - Configurable max retries (default 3)
 * - Distinguishes retryable (network, timeout, 429, 5xx) vs non-retryable errors (400, 401, 404)
 * - Type-safe generic implementation
 */

import { logger } from '@/lib/logger'

const log = logger.child({ module: 'http-retry' })

export interface RetryConfig {
  /**
   * Maximum number of retry attempts (default: 3)
   */
  maxRetries?: number

  /**
   * Initial backoff delay in milliseconds (default: 100)
   */
  initialDelayMs?: number

  /**
   * Maximum backoff delay in milliseconds (default: 10000)
   */
  maxDelayMs?: number

  /**
   * Backoff multiplier (default: 2)
   */
  backoffMultiplier?: number

  /**
   * Jitter factor (0-1, default: 0.3)
   * Adds random variance to prevent thundering herd
   */
  jitterFactor?: number

  /**
   * Custom function to determine if error is retryable
   */
  isRetryable?: (error: unknown) => boolean

  /**
   * Callback invoked before each retry attempt
   */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void
}

export interface RetryError extends Error {
  attempts: number
  lastError: unknown
}

/**
 * Default retryable error checker
 * Returns true for:
 * - Network errors (ECONNRESET, ETIMEDOUT, etc.)
 * - HTTP 429 (Too Many Requests)
 * - HTTP 5xx (Server errors)
 */
function isRetryableError(error: unknown): boolean {
  // Network errors
  if (error instanceof Error) {
    const code = (error as { code?: string }).code
    if (code && ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH'].includes(code)) {
      return true
    }
  }

  // HTTP errors
  if (typeof error === 'object' && error !== null) {
    const statusCode = (error as { statusCode?: number; status?: number }).statusCode || (error as { status?: number }).status

    if (statusCode !== undefined) {
      // Retryable: 429 (rate limit), 5xx (server errors)
      if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
        return true
      }

      // Non-retryable: 4xx (client errors except 429)
      if (statusCode >= 400 && statusCode < 500) {
        return false
      }
    }
  }

  // Unknown errors - default to retryable (conservative)
  return true
}

/**
 * Calculate backoff delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: Required<RetryConfig>): number {
  const exponentialDelay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
    config.maxDelayMs,
  )

  // Add random jitter: delay ± (delay * jitterFactor)
  const jitter = exponentialDelay * config.jitterFactor * (Math.random() * 2 - 1)
  const delayWithJitter = exponentialDelay + jitter

  return Math.max(0, Math.min(delayWithJitter, config.maxDelayMs))
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wrap an async function with retry logic
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @returns Promise resolving to function result
 * @throws RetryError if all retries exhausted
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => fetch('https://api.example.com/data'),
 *   { maxRetries: 3 }
 * )
 * ```
 */
export async function withRetry<T>(fn: () => Promise<T>, config: RetryConfig = {}): Promise<T> {
  const finalConfig: Required<RetryConfig> = {
    maxRetries: config.maxRetries ?? 3,
    initialDelayMs: config.initialDelayMs ?? 100,
    maxDelayMs: config.maxDelayMs ?? 10000,
    backoffMultiplier: config.backoffMultiplier ?? 2,
    jitterFactor: config.jitterFactor ?? 0.3,
    isRetryable: config.isRetryable ?? isRetryableError,
    onRetry: config.onRetry ?? (() => {}),
  }

  let lastError: unknown
  let attempt = 0

  while (attempt <= finalConfig.maxRetries) {
    attempt++

    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Check if error is retryable
      const shouldRetry = finalConfig.isRetryable(error)

      if (!shouldRetry) {
        log.debug({ attempt, error }, 'Error not retryable')
        throw error
      }

      // Check if we have retries left
      if (attempt > finalConfig.maxRetries) {
        log.warn({ attempts: attempt, error }, 'Max retries exhausted')
        break
      }

      // Calculate delay and sleep
      const delayMs = calculateDelay(attempt, finalConfig)
      log.debug({ attempt, delayMs, maxRetries: finalConfig.maxRetries }, 'Retrying after backoff')

      finalConfig.onRetry(attempt, error, delayMs)

      await sleep(delayMs)
    }
  }

  // All retries exhausted
  const retryError = new Error(
    `Max retries (${finalConfig.maxRetries}) exhausted: ${lastError instanceof Error ? lastError.message : 'unknown error'}`,
  ) as RetryError

  retryError.attempts = attempt
  retryError.lastError = lastError

  throw retryError
}

/**
 * Create a reusable retry wrapper with preset configuration
 *
 * @example
 * ```typescript
 * const retryableFetch = createRetryWrapper({ maxRetries: 5 })
 * const data = await retryableFetch(() => fetch('/api/data'))
 * ```
 */
export function createRetryWrapper(config: RetryConfig = {}) {
  return <T>(fn: () => Promise<T>) => withRetry(fn, config)
}
