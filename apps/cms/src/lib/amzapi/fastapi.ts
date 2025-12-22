import { z } from 'zod'

import { env } from '@/lib/env'
import { fetchFromFastAPI } from '@/lib/http/resilientFetch'
import { getRedis } from '@/lib/redis/client'

const ReportSchema = z.object({
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodType: z.string(),
}).passthrough()

const ReportsResponseSchema = z.object({
  items: z.array(ReportSchema),
  total: z.number().optional(),
}).passthrough()

export async function getWeeklyReportDates(args: { limit?: number; cacheTtlSeconds?: number } = {}): Promise<string[]> {
  const limit = Math.max(1, Math.min(50, Math.floor(args.limit ?? 10)))
  const cacheTtlSeconds = Math.max(60, Math.min(86_400, Math.floor(args.cacheTtlSeconds ?? 21_600)))

  const redis = getRedis()
  const cacheKey = `rs:fastapi:reports:weekly:${limit}`

  if (redis) {
    const cached = await redis.get(cacheKey)
    if (cached) {
      const parsed = z.array(z.string()).safeParse(JSON.parse(cached))
      if (parsed.success && parsed.data.length > 0) return parsed.data
    }
  }

  const url = `${env.FASTAPI_URL}/reports/?period_type=WEEK&limit=${limit}`
  const json = await fetchFromFastAPI<unknown>(url, {
    headers: { 'X-API-Key': env.FASTAPI_KEY ?? '' },
    method: 'GET',
  })

  const parsed = ReportsResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error('fastapi_invalid_reports_response')
  }

  const dates = parsed.data.items.map((i) => i.reportDate)
  if (redis && dates.length > 0) {
    await redis.set(cacheKey, JSON.stringify(dates), 'EX', cacheTtlSeconds)
  }

  return dates
}

const KeywordAsinItemSchema = z.object({
  asin: z.string().min(1),
  top3_rank: z.number().int().min(1),
  click_share: z.number(),
  conversion_share: z.number(),
  weighted_score: z.number().optional(),
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  product_title: z.string().optional(),
}).passthrough()

const KeywordAsinsResponseSchema = z.object({
  items: z.array(KeywordAsinItemSchema),
  total: z.number().optional(),
}).passthrough()

export type KeywordAsinItem = z.infer<typeof KeywordAsinItemSchema>

export async function getKeywordAsins(args: {
  keyword: string
  reportDate: string
  limit: number
}): Promise<KeywordAsinItem[]> {
  const limit = Math.max(1, Math.min(10_000, Math.floor(args.limit)))
  const keyword = args.keyword.trim()
  if (!keyword) return []

  const reportDate = args.reportDate
  const url = `${env.FASTAPI_URL}/keywords/${encodeURIComponent(keyword)}/asins?period_type=weekly&start_date=${encodeURIComponent(
    reportDate,
  )}&end_date=${encodeURIComponent(reportDate)}&limit=${limit}&offset=0`

  const json = await fetchFromFastAPI<unknown>(url, {
    headers: { 'X-API-Key': env.FASTAPI_KEY ?? '' },
    method: 'GET',
  })
  const parsed = KeywordAsinsResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error('fastapi_invalid_keyword_asins_response')
  }

  return parsed.data.items
}
