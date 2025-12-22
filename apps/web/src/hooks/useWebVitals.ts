'use client'

import { useEffect } from 'react'

interface Metric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  id: string
  navigationType?: string
}

interface WebVitalsOptions {
  onReport?: (metric: Metric) => void
  debug?: boolean
}

function sendToAnalytics(metric: Metric, debug: boolean = false) {
  if (debug || process.env.NODE_ENV === 'development') {
    console.log(`[Web Vitals] ${metric.name}:`, {
      value: metric.value.toFixed(2),
      rating: metric.rating,
      id: metric.id,
    })
  }

  // Send to analytics endpoint (optional)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    const body = JSON.stringify(metric)
    const url = '/api/vitals'

    // Use `navigator.sendBeacon()` if available, falling back to `fetch()`
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, body)
    } else {
      fetch(url, {
        body,
        method: 'POST',
        keepalive: true,
        headers: {
          'content-type': 'application/json',
        },
      }).catch((err) => {
        if (debug) {
          console.error('[Web Vitals] Failed to send metric:', err)
        }
      })
    }
  }
}

export function useWebVitals(options: WebVitalsOptions = {}) {
  const { onReport, debug = false } = options

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return

    // Dynamically import web-vitals to avoid bundling it in SSR
    import('web-vitals')
      .then(({ onCLS, onFCP, onLCP, onTTFB, onINP }) => {
        const reportMetric = (metric: Metric) => {
          sendToAnalytics(metric, debug)
          if (onReport) {
            onReport(metric)
          }
        }

        // Core Web Vitals
        onCLS(reportMetric) // Cumulative Layout Shift
        onLCP(reportMetric) // Largest Contentful Paint
        onINP(reportMetric) // Interaction to Next Paint (replaces FID)

        // Other Web Vitals
        onFCP(reportMetric) // First Contentful Paint
        onTTFB(reportMetric) // Time to First Byte
      })
      .catch((err) => {
        if (debug) {
          console.error('[Web Vitals] Failed to load library:', err)
        }
      })
  }, [onReport, debug])
}

// Helper hook to enable Web Vitals in development mode
export function useWebVitalsDev() {
  useWebVitals({ debug: true })
}
