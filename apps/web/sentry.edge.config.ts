import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  enabled: process.env.NODE_ENV === 'production',

  tracesSampleRate: 0.1,

  beforeSend(event) {
    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization']
    }

    return event
  },

  initialScope: {
    tags: {
      service: 'ranksheet-web',
      runtime: 'edge',
    },
  },
})
