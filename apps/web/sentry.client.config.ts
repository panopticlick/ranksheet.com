import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  enabled: process.env.NODE_ENV === 'production',

  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% sampling

  // Session Replay
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% on errors

  // Filter sensitive data
  beforeSend(event) {
    // Remove authorization headers
    if (event.request?.headers) {
      delete event.request.headers['authorization']
    }

    return event
  },

  // Ignore common non-errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    'Network request failed',
  ],

  initialScope: {
    tags: {
      service: 'ranksheet-web',
    },
  },
})
