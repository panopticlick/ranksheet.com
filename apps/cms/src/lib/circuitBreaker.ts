import CircuitBreaker from 'opossum'
import { logger } from '@/lib/logger'

export interface CircuitBreakerOptions {
  timeout?: number // Request timeout in ms (default: 10000)
  errorThresholdPercentage?: number // Error threshold percentage (default: 50)
  resetTimeout?: number // Time in ms before attempting to close the circuit again (default: 30000)
  rollingCountTimeout?: number // Time window for calculating stats (default: 10000)
  rollingCountBuckets?: number // Number of buckets in rolling window (default: 10)
  volumeThreshold?: number // Minimum requests before circuit can open (default: 5)
  name?: string // Name for logging
}

const DEFAULT_OPTIONS: Required<Omit<CircuitBreakerOptions, 'name'>> = {
  timeout: 10000, // 10 seconds
  errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
  resetTimeout: 30000, // Try again after 30 seconds
  rollingCountTimeout: 10000, // 10 second window
  rollingCountBuckets: 10, // 1 second per bucket
  volumeThreshold: 5, // Need at least 5 requests before opening circuit
}

/**
 * Creates a circuit breaker for a function
 */
export function createCircuitBreaker<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  options: CircuitBreakerOptions = {},
): CircuitBreaker<T, R> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const name = options.name || fn.name || 'unknown'

  const breaker = new CircuitBreaker<T, R>(fn, {
    timeout: opts.timeout,
    errorThresholdPercentage: opts.errorThresholdPercentage,
    resetTimeout: opts.resetTimeout,
    rollingCountTimeout: opts.rollingCountTimeout,
    rollingCountBuckets: opts.rollingCountBuckets,
    volumeThreshold: opts.volumeThreshold,
    name,
  })

  // Event listeners for logging
  breaker.on('open', () => {
    logger.warn({ circuit: name }, 'circuit_breaker_opened')
  })

  breaker.on('halfOpen', () => {
    logger.info({ circuit: name }, 'circuit_breaker_half_opened')
  })

  breaker.on('close', () => {
    logger.info({ circuit: name }, 'circuit_breaker_closed')
  })

  breaker.on('timeout', (...args) => {
    logger.warn({ circuit: name, timeout: args[0] }, 'circuit_breaker_timeout')
  })

  breaker.on('failure', (err: Error) => {
    logger.warn({ circuit: name, err }, 'circuit_breaker_failure')
  })

  breaker.on('success', (...args) => {
    logger.debug({ circuit: name, latency: args[1] }, 'circuit_breaker_success')
  })

  return breaker
}

/**
 * Fallback function that returns cached data or null
 */
export function createFallback<T>(cachedValue: T | null = null): (err: Error) => T | null {
  return (err: Error) => {
    logger.warn({ err }, 'circuit_breaker_fallback_used')
    return cachedValue
  }
}

/**
 * Helper to get circuit breaker health status
 */
export function getCircuitStats(breaker: CircuitBreaker<unknown[], unknown>) {
  return {
    name: breaker.name,
    state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
    enabled: breaker.enabled,
    stats: {
      failures: breaker.stats.failures,
      successes: breaker.stats.successes,
      timeouts: breaker.stats.timeouts,
      rejects: breaker.stats.rejects,
      fires: breaker.stats.fires,
      cacheHits: breaker.stats.cacheHits,
      cacheMisses: breaker.stats.cacheMisses,
    },
  }
}
