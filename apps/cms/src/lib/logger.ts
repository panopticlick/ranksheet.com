import pino from 'pino'

import { env } from '@/lib/env'

/**
 * NOTE:
 * Next.js server bundling can break pino transports (worker thread file resolution),
 * causing runtime crashes like "Cannot find module .../lib/worker.js" / "the worker has exited".
 *
 * Keep logging transport-free inside the app. Format logs in the environment instead.
 */
export const logger = pino({
  level: env.LOG_LEVEL,

  // Enhanced formatting
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      node_version: process.version,
    }),
  },

  // Standard serializers for errors and HTTP requests
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },

  // Redact sensitive information
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-job-token"]',
      'req.headers.cookie',
      '*.password',
      '*.secret',
      '*.token',
      '*.apiKey',
      '*.api_key',
      'DATABASE_URI',
      'REDIS_URL',
    ],
    remove: true,
  },

  // Add timestamp in ISO format
  timestamp: pino.stdTimeFunctions.isoTime,
})

/**
 * Create a child logger with additional context
 *
 * @example
 * const log = createChildLogger({ operation: 'refresh_keyword', slug: 'test' })
 * log.info('Processing started')
 */
export const createChildLogger = (context: Record<string, unknown>) => {
  return logger.child(context)
}
