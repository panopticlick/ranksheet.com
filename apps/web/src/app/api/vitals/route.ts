import { NextRequest, NextResponse } from 'next/server'

interface VitalsPayload {
  id: string
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  navigationType: string
}

/**
 * API endpoint to receive Web Vitals metrics
 *
 * In production, you can:
 * 1. Store metrics in a database for analysis
 * 2. Forward to analytics service (Vercel Analytics, Google Analytics, etc.)
 * 3. Send alerts for poor metrics
 *
 * For now, we'll just log them server-side
 */
export async function POST(request: NextRequest) {
  try {
    const metric: VitalsPayload = await request.json()

    // Validate metric structure
    if (!metric.name || typeof metric.value !== 'number') {
      return NextResponse.json({ error: 'Invalid metric format' }, { status: 400 })
    }

    // Log metrics (in production, store in DB or analytics service)
    console.log('[Web Vitals]', {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      url: request.headers.get('referer') || 'unknown',
      userAgent: request.headers.get('user-agent')?.slice(0, 100),
    })

    // TODO: In production, consider:
    // 1. Storing in database for long-term analysis
    // 2. Forwarding to Vercel Analytics: https://vercel.com/docs/analytics
    // 3. Sending to custom analytics (Umami, Plausible, etc.)
    // 4. Creating alerts for consistently poor metrics

    // Example: Send alert if metric is "poor"
    if (metric.rating === 'poor') {
      console.warn(`[Web Vitals Alert] Poor ${metric.name}: ${metric.value}`)
      // TODO: Send to monitoring service (Sentry, Slack, etc.)
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[Web Vitals API] Error processing metric:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Handle CORS if needed (for cross-origin reporting)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
