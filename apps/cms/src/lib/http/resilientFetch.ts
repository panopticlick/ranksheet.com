import CircuitBreaker from 'opossum'
import { createCircuitBreaker } from '@/lib/circuitBreaker'
import { fetchJson } from '@/lib/http/fetchJson'
import { logger } from '@/lib/logger'

// Circuit breakers for different upstream services
let fastAPIBreaker: CircuitBreaker<[string, RequestInit?], unknown> | null = null
let expressAPIBreaker: CircuitBreaker<[string, RequestInit?], unknown> | null = null

/**
 * Get or create FastAPI circuit breaker
 */
function getFastAPIBreaker() {
  if (!fastAPIBreaker) {
    fastAPIBreaker = createCircuitBreaker(
      async (url: string, init?: RequestInit) => {
        return await fetchJson(url, { ...init, timeoutMs: 15000 })
      },
      {
        timeout: 15000, // 15 seconds
        errorThresholdPercentage: 60, // Open after 60% failure rate
        resetTimeout: 60000, // Try again after 1 minute
        rollingCountTimeout: 30000, // 30 second window
        volumeThreshold: 3, // Need 3 requests minimum
        name: 'fastapi',
      },
    )
  }
  return fastAPIBreaker
}

/**
 * Get or create Express API circuit breaker
 */
function getExpressAPIBreaker() {
  if (!expressAPIBreaker) {
    expressAPIBreaker = createCircuitBreaker(
      async (url: string, init?: RequestInit) => {
        return await fetchJson(url, { ...init, timeoutMs: 10000 })
      },
      {
        timeout: 10000, // 10 seconds
        errorThresholdPercentage: 50, // Open after 50% failure rate
        resetTimeout: 30000, // Try again after 30 seconds
        rollingCountTimeout: 20000, // 20 second window
        volumeThreshold: 5, // Need 5 requests minimum
        name: 'express',
      },
    )
  }
  return expressAPIBreaker
}

/**
 * Fetch from FastAPI with circuit breaker protection
 */
export async function fetchFromFastAPI<T>(
  url: string,
  init?: RequestInit,
  options?: { fallbackValue?: T },
): Promise<T> {
  const breaker = getFastAPIBreaker()

  try {
    // If circuit is open, immediately reject
    if (breaker.opened) {
      logger.warn({ url, circuit: 'fastapi' }, 'circuit_breaker_rejecting_fastapi_request')

      if (options?.fallbackValue !== undefined) {
        return options.fallbackValue
      }

      throw new Error('FastAPI circuit breaker is open - service temporarily unavailable')
    }

    const result = await breaker.fire(url, init)
    return result as T
  } catch (err) {
    // If we have a fallback value, use it
    if (options?.fallbackValue !== undefined) {
      logger.warn({ url, err }, 'using_fallback_for_fastapi')
      return options.fallbackValue
    }

    throw err
  }
}

/**
 * Fetch from Express API with circuit breaker protection
 */
export async function fetchFromExpressAPI<T>(
  url: string,
  init?: RequestInit,
  options?: { fallbackValue?: T },
): Promise<T> {
  const breaker = getExpressAPIBreaker()

  try {
    // If circuit is open, immediately reject
    if (breaker.opened) {
      logger.warn({ url, circuit: 'express' }, 'circuit_breaker_rejecting_express_request')

      if (options?.fallbackValue !== undefined) {
        return options.fallbackValue
      }

      throw new Error('Express API circuit breaker is open - service temporarily unavailable')
    }

    const result = await breaker.fire(url, init)
    return result as T
  } catch (err) {
    // If we have a fallback value, use it
    if (options?.fallbackValue !== undefined) {
      logger.warn({ url, err }, 'using_fallback_for_express')
      return options.fallbackValue
    }

    throw err
  }
}

/**
 * Get health status of all circuit breakers
 */
export function getCircuitBreakerHealth() {
  return {
    fastapi: fastAPIBreaker
      ? {
          state: fastAPIBreaker.opened
            ? 'open'
            : fastAPIBreaker.halfOpen
              ? 'half-open'
              : 'closed',
          stats: {
            failures: fastAPIBreaker.stats.failures,
            successes: fastAPIBreaker.stats.successes,
            timeouts: fastAPIBreaker.stats.timeouts,
            rejects: fastAPIBreaker.stats.rejects,
          },
        }
      : { state: 'not-initialized' },
    express: expressAPIBreaker
      ? {
          state: expressAPIBreaker.opened
            ? 'open'
            : expressAPIBreaker.halfOpen
              ? 'half-open'
              : 'closed',
          stats: {
            failures: expressAPIBreaker.stats.failures,
            successes: expressAPIBreaker.stats.successes,
            timeouts: expressAPIBreaker.stats.timeouts,
            rejects: expressAPIBreaker.stats.rejects,
          },
        }
      : { state: 'not-initialized' },
  }
}

/**
 * Reset all circuit breakers (useful for testing or manual recovery)
 */
export function resetCircuitBreakers() {
  if (fastAPIBreaker) {
    fastAPIBreaker.close()
    logger.info('fastapi_circuit_breaker_manually_reset')
  }
  if (expressAPIBreaker) {
    expressAPIBreaker.close()
    logger.info('express_circuit_breaker_manually_reset')
  }
}
