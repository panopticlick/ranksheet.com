import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  enabled: process.env.NODE_ENV === 'production',

  // Performance Monitoring
  tracesSampleRate: 0.2, // 20% sampling for server-side

  // Note: Sentry v8+ has integrations enabled by default
  // PostgreSQL and HTTP tracing are automatically included
  // See: https://docs.sentry.io/platforms/javascript/guides/nextjs/

  // Filter sensitive data
  beforeSend(event) {
    // Remove database connection strings
    if (event.contexts?.runtime?.name === 'node' && event.extra) {
      const filteredExtra: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(event.extra)) {
        if (typeof value === 'string' && value.includes('postgresql://')) {
          filteredExtra[key] = '[DATABASE_URI REDACTED]'
        } else {
          filteredExtra[key] = value
        }
      }
      event.extra = filteredExtra
    }

    // Remove authorization headers
    if (event.request?.headers) {
      delete event.request.headers['authorization']
      delete event.request.headers['x-job-token']
    }

    return event
  },

  // Tag all errors with service name
  initialScope: {
    tags: {
      service: 'ranksheet-cms',
    },
  },
})
