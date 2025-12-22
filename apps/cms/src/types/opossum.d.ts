/**
 * Type definitions for opossum
 * @see https://github.com/nodeshift/opossum
 */

declare module 'opossum' {
  export interface CircuitBreakerOptions {
    timeout?: number
    errorThresholdPercentage?: number
    resetTimeout?: number
    rollingCountTimeout?: number
    rollingCountBuckets?: number
    name?: string
    group?: string
    enabled?: boolean
    allowWarmUp?: boolean
    volumeThreshold?: number
    errorFilter?: (err: Error) => boolean
    cache?: boolean
    cacheTTL?: number
    abortController?: AbortController
  }

  export interface CircuitBreakerStats {
    fires: number
    successes: number
    failures: number
    rejects: number
    timeouts: number
    cacheHits: number
    cacheMisses: number
    semaphoreRejections: number
    percentiles: { [key: number]: number }
    latencyMean: number
    latencyTimes: number[]
  }

  export default class CircuitBreaker<T extends unknown[], R> {
    constructor(
      fn: (...args: T) => Promise<R>,
      options?: CircuitBreakerOptions,
    )

    fire(...args: T): Promise<R>
    fallback(fn: (...args: T) => R | Promise<R>): this
    healthCheck(fn: () => Promise<boolean>, interval?: number): void
    enable(): void
    disable(): void
    open(): void
    close(): void
    shutdown(): void
    isShutdown(): boolean

    readonly name: string
    readonly group: string
    readonly opened: boolean
    readonly closed: boolean
    readonly halfOpen: boolean
    readonly pendingClose: boolean
    readonly warmUp: boolean
    readonly volumeThreshold: number
    readonly enabled: boolean
    readonly stats: CircuitBreakerStats

    on(event: 'fire', listener: (...args: T) => void): this
    on(event: 'reject', listener: (error: Error) => void): this
    on(event: 'timeout', listener: (...args: unknown[]) => void): this
    on(event: 'success', listener: (...args: unknown[]) => void): this
    on(event: 'failure', listener: (error: Error) => void): this
    on(event: 'open', listener: () => void): this
    on(event: 'close', listener: () => void): this
    on(event: 'halfOpen', listener: () => void): this
    on(
      event: 'fallback',
      listener: (result: R, error: Error) => void,
    ): this
    on(event: 'semaphoreLocked', listener: (error: Error) => void): this
    on(event: 'healthCheckFailed', listener: (error: Error) => void): this
    on(event: string, listener: (...args: unknown[]) => void): this

    off(event: string, listener: (...args: unknown[]) => void): this
    removeAllListeners(event?: string): this
  }

  export function isOurError(error: unknown): boolean
}
