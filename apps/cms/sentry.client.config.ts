import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  enabled: process.env.NODE_ENV === 'production',

  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% sampling for performance

  // Session Replay
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% when errors occur

  // Filter sensitive data
  beforeSend(event) {
    // Remove authorization headers
    if (event.request?.headers) {
      delete event.request.headers['authorization']
      delete event.request.headers['x-job-token']
    }

    // Remove sensitive cookies
    if (event.request?.cookies) {
      delete event.request.cookies['payload-token']
    }

    return event
  },

  // Ignore common non-errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
  ],
})
