import { getDbPool } from '@/lib/db/pool'

export type ClicksTimeSeriesPoint = {
  day: string
  clicks: number
}

export type ClicksTopItem = {
  key: string
  clicks: number
}

export type ClickAnalyticsOverview = {
  totals: {
    clicks24h: number
    clicks7d: number
    clicks30d: number
    clicksAllTime: number
  }
  series30d: ClicksTimeSeriesPoint[]
  topKeywords7d: ClicksTopItem[]
  topAsins7d: ClicksTopItem[]
  topPositions7d: ClicksTopItem[]
}

function isoDateDaysAgo(daysAgo: number): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

function toInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string' && value.trim()) {
    const n = Number.parseInt(value, 10)
    if (Number.isFinite(n)) return n
  }
  return 0
}

export async function getClickAnalyticsOverview(): Promise<ClickAnalyticsOverview> {
  const pool = getDbPool()

  const start30 = isoDateDaysAgo(29)
  const start7 = isoDateDaysAgo(6)

  const [seriesRes, clicks24hRes, clicks7dRes, clicks30dRes, clicksAllTimeRes, topKeywordsRes, topAsinsRes, topPosRes] =
    await Promise.all([
      pool.query<{ day: string; clicks: string }>(
        `
          SELECT day::text AS day, COALESCE(SUM(clicks), 0)::text AS clicks
          FROM ranksheet.affiliate_clicks_daily
          WHERE day >= $1::date
          GROUP BY day
          ORDER BY day ASC
        `,
        [start30],
      ),
      pool.query<{ clicks: string }>(
        `
          SELECT COUNT(*)::text AS clicks
          FROM ranksheet.affiliate_clicks
          WHERE clicked_at >= NOW() - INTERVAL '24 hours'
        `,
      ),
      pool.query<{ clicks: string }>(
        `
          SELECT COALESCE(SUM(clicks), 0)::text AS clicks
          FROM ranksheet.affiliate_clicks_daily
          WHERE day >= $1::date
        `,
        [start7],
      ),
      pool.query<{ clicks: string }>(
        `
          SELECT COALESCE(SUM(clicks), 0)::text AS clicks
          FROM ranksheet.affiliate_clicks_daily
          WHERE day >= $1::date
        `,
        [start30],
      ),
      pool.query<{ clicks: string }>(
        `
          SELECT COUNT(*)::text AS clicks
          FROM ranksheet.affiliate_clicks
        `,
      ),
      pool.query<{ keyword_slug: string; clicks: string }>(
        `
          SELECT keyword_slug, COALESCE(SUM(clicks), 0)::text AS clicks
          FROM ranksheet.affiliate_clicks_daily
          WHERE day >= $1::date
          GROUP BY keyword_slug
          ORDER BY COALESCE(SUM(clicks), 0) DESC
          LIMIT 25
        `,
        [start7],
      ),
      pool.query<{ asin: string; clicks: string }>(
        `
          SELECT asin, COALESCE(SUM(clicks), 0)::text AS clicks
          FROM ranksheet.affiliate_clicks_daily
          WHERE day >= $1::date
            AND asin IS NOT NULL
            AND asin <> ''
          GROUP BY asin
          ORDER BY COALESCE(SUM(clicks), 0) DESC
          LIMIT 25
        `,
        [start7],
      ),
      pool.query<{ position_context: string | null; clicks: string }>(
        `
          SELECT position_context, COUNT(*)::text AS clicks
          FROM ranksheet.affiliate_clicks
          WHERE clicked_at >= NOW() - INTERVAL '7 days'
          GROUP BY position_context
          ORDER BY COUNT(*) DESC
          LIMIT 25
        `,
      ),
    ])

  const series30d: ClicksTimeSeriesPoint[] = seriesRes.rows.map((r) => ({
    day: r.day,
    clicks: toInt(r.clicks),
  }))

  return {
    totals: {
      clicks24h: toInt(clicks24hRes.rows[0]?.clicks),
      clicks7d: toInt(clicks7dRes.rows[0]?.clicks),
      clicks30d: toInt(clicks30dRes.rows[0]?.clicks),
      clicksAllTime: toInt(clicksAllTimeRes.rows[0]?.clicks),
    },
    series30d,
    topKeywords7d: topKeywordsRes.rows.map((r) => ({ key: r.keyword_slug, clicks: toInt(r.clicks) })),
    topAsins7d: topAsinsRes.rows.map((r) => ({ key: r.asin, clicks: toInt(r.clicks) })),
    topPositions7d: topPosRes.rows.map((r) => ({ key: r.position_context ?? '(unknown)', clicks: toInt(r.clicks) })),
  }
}

