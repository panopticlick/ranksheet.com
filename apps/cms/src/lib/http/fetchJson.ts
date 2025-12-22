import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

export class HttpError extends Error {
  readonly status: number
  readonly url: string
  readonly bodyText: string

  constructor(args: { status: number; url: string; bodyText: string }) {
    super(`HTTP ${args.status} for ${args.url}`)
    this.status = args.status
    this.url = args.url
    this.bodyText = args.bodyText
  }
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number; logKey?: string; requestId?: string } = {},
): Promise<T> {
  const { timeoutMs = 15_000, logKey, requestId, ...rest } = init

  // Generate or use provided request ID for tracing
  const traceId = requestId || crypto.randomUUID()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const startTime = Date.now()

  try {
    logger.debug({ url, requestId: traceId, method: rest.method || 'GET' }, 'Making HTTP request')

    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        ...(rest.headers ?? {}),
        'User-Agent': `ranksheet-cms/${env.NODE_ENV}`,
        'x-request-id': traceId,
      },
      cache: 'no-store',
    })

    const duration = Date.now() - startTime
    const upstreamRequestId = res.headers.get('x-request-id')

    logger.debug(
      {
        url,
        status: res.status,
        requestId: traceId,
        upstreamRequestId,
        duration,
      },
      'HTTP response received',
    )

    const text = await res.text()
    if (!res.ok) {
      if (logKey) {
        logger.warn(
          {
            status: res.status,
            url,
            requestId: traceId,
            duration,
          },
          logKey,
        )
      }
      throw new HttpError({ status: res.status, url, bodyText: text.slice(0, 2000) })
    }

    return JSON.parse(text) as T
  } catch (err) {
    const duration = Date.now() - startTime
    logger.error(
      {
        err,
        url,
        requestId: traceId,
        duration,
      },
      'HTTP request failed',
    )
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

