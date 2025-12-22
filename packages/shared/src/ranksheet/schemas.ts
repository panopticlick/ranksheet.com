import { z } from 'zod'

export const KeywordStatusSchema = z.enum(['PENDING', 'WARMING_UP', 'ACTIVE', 'PAUSED', 'ERROR'])

export const KeywordSchema = z.object({
  slug: z.string(),
  keyword: z.string(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  marketplace: z.string().nullable().optional(),
  topN: z.number().int().min(5).max(50).optional(),
  isActive: z.boolean().optional(),
  status: KeywordStatusSchema,
  statusReason: z.string().nullable().optional(),
  indexable: z.boolean(),
  priority: z.number().int().optional(),
  lastRefreshedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
})

export const ReadinessLevelSchema = z.enum(['FULL', 'PARTIAL', 'LOW', 'CRITICAL'])
export const SheetModeSchema = z.enum(['NORMAL', 'LOW_DATA'])

export const SanitizedRowSchema = z.object({
  rank: z.number().int().min(1),
  asin: z.string().min(1),
  title: z.string().min(1),
  brand: z.string().min(1),
  image: z.string().url(),
  score: z.number().int().min(1).max(100),
  marketShareIndex: z.number().int().min(0).max(100),
  buyerTrustIndex: z.number().int().min(0).max(100),
  trendDelta: z.number().int(),
  trendLabel: z.enum(['Rising', 'Falling', 'Stable']),
  badges: z.array(z.string()),
  affiliateUrl: z.string().url().optional(),
})

export const PublicSheetSchema = z.object({
  dataPeriod: z.string().min(1),
  updatedAt: z.string().datetime(),
  mode: SheetModeSchema,
  validCount: z.number().int().min(0),
  readinessLevel: ReadinessLevelSchema,
  rows: z.array(SanitizedRowSchema),
})

export const PublicSheetsResponseSchema = z.object({
  keyword: KeywordSchema,
  sheet: PublicSheetSchema.nullable(),
  availablePeriods: z
    .array(
      z.object({
        dataPeriod: z.string().min(1),
        updatedAt: z.string().datetime(),
        readinessLevel: ReadinessLevelSchema,
        validCount: z.number().int().min(0),
      }),
    )
    .optional(),
  related: z.array(
    z.object({
      slug: z.string(),
      keyword: z.string(),
      topN: z.number().int().min(5).max(50).optional(),
      lastRefreshedAt: z.string().datetime().nullable().optional(),
    }),
  ),
  relatedPagination: z.object({
    limit: z.number().int().min(1).max(50),
    hasMore: z.boolean(),
  }).optional(),
})

export const PublicKeywordsResponseSchema = z.object({
  keywords: z.array(
    z.object({
      slug: z.string(),
      keyword: z.string(),
      category: z.string().nullable().optional(),
      indexable: z.boolean(),
      lastRefreshedAt: z.string().datetime().nullable().optional(),
    }),
  ),
  total: z.number().int().min(0),
})

export const PublicCategoryHighlightsItemSchema = z.object({
  slug: z.string(),
  keyword: z.string(),
  lastRefreshedAt: z.string().datetime().nullable().optional(),
})

export const PublicCategoryHighlightsResponseSchema = z.object({
  ok: z.literal(true),
  category: z.string(),
  recentlyUpdated: z.array(PublicCategoryHighlightsItemSchema),
  hotThisWeek: z.array(PublicCategoryHighlightsItemSchema),
})

export const PublicCategoryTickerItemSchema = z.object({
  slug: z.string(),
  keyword: z.string(),
  title: z.string().min(1),
  topN: z.number().int().min(5).max(50).optional(),
  lastRefreshedAt: z.string().datetime().nullable().optional(),
  dataPeriod: z.string().nullable().optional(),
  updatedAt: z.string().datetime().nullable().optional(),
  leader: SanitizedRowSchema.nullable(),
  maxRise: z.number().int().nullable().optional(),
  volatility: z.number().nullable().optional(),
})

export const PublicCategoryTickersResponseSchema = z.object({
  ok: z.literal(true),
  category: z.string(),
  tracking: z.number().int().min(0),
  tickers: z.array(PublicCategoryTickerItemSchema),
  topGainer: PublicCategoryTickerItemSchema.nullable().optional(),
  mostVolatile: PublicCategoryTickerItemSchema.nullable().optional(),
})

export const PublicSearchResponseSchema = z.object({
  ok: z.literal(true),
  q: z.string(),
  items: z.array(
    z.object({
      slug: z.string(),
      keyword: z.string(),
      category: z.string().nullable().optional(),
      lastRefreshedAt: z.string().datetime().nullable().optional(),
    }),
  ),
})

export const PublicSearchIndexResponseSchema = z.object({
  ok: z.literal(true),
  items: z.array(
    z.object({
      slug: z.string(),
      title: z.string().min(1),
    }),
  ),
})

export const PublicKeywordRequestItemSchema = z.object({
  id: z.number().int().min(1),
  slug: z.string(),
  keyword: z.string(),
  category: z.string().nullable().optional(),
  votes: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const PublicKeywordRequestsListResponseSchema = z.object({
  ok: z.literal(true),
  items: z.array(PublicKeywordRequestItemSchema),
  total: z.number().int().min(0),
})

export const PublicSheetTrendPointSchema = z.object({
  dataPeriod: z.string().min(1),
  rank: z.number().int().min(1).nullable(),
  score: z.number().int().min(1).max(100).nullable(),
})

export const PublicSheetMiniTrendsItemSchema = z.object({
  slug: z.string(),
  asin: z.string().min(1).nullable().optional(),
  points: z.array(PublicSheetTrendPointSchema),
})

export const PublicSheetMiniTrendsResponseSchema = z.object({
  ok: z.literal(true),
  items: z.array(PublicSheetMiniTrendsItemSchema),
})

export const PublicSheetTrendsResponseSchema = z.object({
  ok: z.literal(true),
  slug: z.string(),
  keyword: z.object({
    slug: z.string(),
    keyword: z.string(),
  }),
  periods: z.array(
    z.object({
      dataPeriod: z.string().min(1),
      updatedAt: z.string().datetime(),
      readinessLevel: ReadinessLevelSchema,
      validCount: z.number().int().min(0),
    }),
  ),
  series: z.array(
    z.object({
      asin: z.string().min(1),
      title: z.string().min(1),
      brand: z.string().min(1),
      image: z.string().url(),
      points: z.array(PublicSheetTrendPointSchema),
    }),
  ),
})
