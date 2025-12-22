import {
  PublicCategoryHighlightsResponseSchema,
  PublicCategoryTickersResponseSchema,
  PublicKeywordRequestsListResponseSchema,
  PublicKeywordsResponseSchema,
  PublicSearchIndexResponseSchema,
  PublicSearchResponseSchema,
  PublicSheetsResponseSchema,
} from '@ranksheet/shared'
import type { z } from 'zod'

import { env } from '@/lib/env'
import { fetchJson } from '@/lib/http/fetchJson'

export type PublicSheetResponse = z.infer<typeof PublicSheetsResponseSchema>
export type PublicKeywordsResponse = z.infer<typeof PublicKeywordsResponseSchema>
export type PublicCategoryHighlightsResponse = z.infer<typeof PublicCategoryHighlightsResponseSchema>
export type PublicCategoryTickersResponse = z.infer<typeof PublicCategoryTickersResponseSchema>
export type PublicSearchResponse = z.infer<typeof PublicSearchResponseSchema>
export type PublicSearchIndexResponse = z.infer<typeof PublicSearchIndexResponseSchema>
export type PublicKeywordRequestsListResponse = z.infer<typeof PublicKeywordRequestsListResponseSchema>

type NextFetchOptions = RequestInit & { next?: { revalidate?: number } }

export async function getPublicSheetBySlug(
  slug: string,
  args: { period?: string | null; periodsLimit?: number; relatedLimit?: number } = {},
  options: { revalidateSeconds?: number } = {},
): Promise<PublicSheetResponse> {
  const safeSlug = slug.trim()
  const url = new URL(`${env.CMS_PUBLIC_URL}/api/public/sheets/${encodeURIComponent(safeSlug)}`)
  if (args.period) url.searchParams.set('period', args.period)
  if (typeof args.periodsLimit === 'number') url.searchParams.set('periodsLimit', String(args.periodsLimit))
  if (typeof args.relatedLimit === 'number') url.searchParams.set('relatedLimit', String(args.relatedLimit))

  const json = await fetchJson<unknown>(url.toString(), {
    ...(options.revalidateSeconds ? ({ next: { revalidate: options.revalidateSeconds } } satisfies NextFetchOptions) : {}),
    timeoutMs: 20_000,
  })

  const parsed = PublicSheetsResponseSchema.safeParse(json)
  if (!parsed.success) throw new Error('cms_invalid_public_sheet_response')

  return parsed.data
}

export async function getPublicKeywords(
  args: { category?: string; limit?: number; offset?: number } = {},
  options: { revalidateSeconds?: number } = {},
): Promise<PublicKeywordsResponse> {
  const url = new URL(`${env.CMS_PUBLIC_URL}/api/public/keywords`)
  if (args.category) url.searchParams.set('category', args.category)
  if (typeof args.limit === 'number') url.searchParams.set('limit', String(args.limit))
  if (typeof args.offset === 'number') url.searchParams.set('offset', String(args.offset))

  const json = await fetchJson<unknown>(url.toString(), {
    ...(options.revalidateSeconds ? ({ next: { revalidate: options.revalidateSeconds } } satisfies NextFetchOptions) : {}),
    timeoutMs: 20_000,
  })

  const parsed = PublicKeywordsResponseSchema.safeParse(json)
  if (!parsed.success) throw new Error('cms_invalid_public_keywords_response')

  return parsed.data
}

export async function getPublicCategoryHighlights(
  args: { category: string },
  options: { revalidateSeconds?: number } = {},
): Promise<PublicCategoryHighlightsResponse> {
  const safe = args.category.trim()
  const url = `${env.CMS_PUBLIC_URL}/api/public/categories/${encodeURIComponent(safe)}/highlights`

  const json = await fetchJson<unknown>(url, {
    ...(options.revalidateSeconds ? ({ next: { revalidate: options.revalidateSeconds } } satisfies NextFetchOptions) : {}),
    timeoutMs: 15_000,
  })

  const parsed = PublicCategoryHighlightsResponseSchema.safeParse(json)
  if (!parsed.success) throw new Error('cms_invalid_public_category_highlights_response')

  return parsed.data
}

export async function getPublicCategoryTickers(
  args: { category: string; limit?: number; offset?: number },
  options: { revalidateSeconds?: number } = {},
): Promise<PublicCategoryTickersResponse> {
  const safe = args.category.trim()
  const url = new URL(`${env.CMS_PUBLIC_URL}/api/public/categories/${encodeURIComponent(safe)}/tickers`)
  if (typeof args.limit === 'number') url.searchParams.set('limit', String(args.limit))
  if (typeof args.offset === 'number') url.searchParams.set('offset', String(args.offset))

  const json = await fetchJson<unknown>(url.toString(), {
    ...(options.revalidateSeconds ? ({ next: { revalidate: options.revalidateSeconds } } satisfies NextFetchOptions) : {}),
    timeoutMs: 20_000,
  })

  const parsed = PublicCategoryTickersResponseSchema.safeParse(json)
  if (!parsed.success) throw new Error('cms_invalid_public_category_tickers_response')

  return parsed.data
}

export async function searchPublicKeywords(
  args: { q: string; category?: string; limit?: number },
  options: { revalidateSeconds?: number } = {},
): Promise<PublicSearchResponse> {
  const url = new URL(`${env.CMS_PUBLIC_URL}/api/public/search`)
  url.searchParams.set('q', args.q)
  if (args.category) url.searchParams.set('category', args.category)
  if (typeof args.limit === 'number') url.searchParams.set('limit', String(args.limit))

  const json = await fetchJson<unknown>(url.toString(), {
    ...(options.revalidateSeconds ? ({ next: { revalidate: options.revalidateSeconds } } satisfies NextFetchOptions) : {}),
    timeoutMs: 15_000,
  })

  const parsed = PublicSearchResponseSchema.safeParse(json)
  if (!parsed.success) throw new Error('cms_invalid_public_search_response')

  return parsed.data
}

export async function getPublicSearchIndex(
  args: { limit?: number } = {},
  options: { revalidateSeconds?: number } = {},
): Promise<PublicSearchIndexResponse> {
  const url = new URL(`${env.CMS_PUBLIC_URL}/api/public/search-index`)
  if (typeof args.limit === 'number') url.searchParams.set('limit', String(args.limit))

  const json = await fetchJson<unknown>(url.toString(), {
    ...(options.revalidateSeconds ? ({ next: { revalidate: options.revalidateSeconds } } satisfies NextFetchOptions) : {}),
    timeoutMs: 20_000,
  })

  const parsed = PublicSearchIndexResponseSchema.safeParse(json)
  if (!parsed.success) throw new Error('cms_invalid_public_search_index_response')

  return parsed.data
}

export async function getPublicKeywordRequests(
  args: { limit?: number; offset?: number } = {},
  options: { revalidateSeconds?: number } = {},
): Promise<PublicKeywordRequestsListResponse> {
  const url = new URL(`${env.CMS_PUBLIC_URL}/api/public/keyword-requests`)
  if (typeof args.limit === 'number') url.searchParams.set('limit', String(args.limit))
  if (typeof args.offset === 'number') url.searchParams.set('offset', String(args.offset))

  const json = await fetchJson<unknown>(url.toString(), {
    ...(options.revalidateSeconds ? ({ next: { revalidate: options.revalidateSeconds } } satisfies NextFetchOptions) : {}),
    timeoutMs: 20_000,
  })

  const parsed = PublicKeywordRequestsListResponseSchema.safeParse(json)
  if (!parsed.success) throw new Error('cms_invalid_public_keyword_requests_response')

  return parsed.data
}
