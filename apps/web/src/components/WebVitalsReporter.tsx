'use client'

import { useWebVitals } from '@/hooks/useWebVitals'

/**
 * Web Vitals Reporter Component
 *
 * This component automatically tracks Core Web Vitals metrics
 * and reports them to the /api/vitals endpoint for monitoring.
 *
 * Tracked metrics: LCP, FID, CLS, INP, FCP, TTFB
 */
export function WebVitalsReporter() {
  useWebVitals({
    debug: process.env.NODE_ENV === 'development',
  })

  return null
}
