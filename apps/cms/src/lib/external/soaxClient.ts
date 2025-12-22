/**
 * SOAX API Client
 * 提供 SERP API 和 Web Scraping 功能
 */

import { logger } from '../logger'

// ============================================================================
// Types
// ============================================================================

export interface GoogleShoppingProduct {
  position: number
  title: string
  link: string
  product_link?: string
  product_id?: string
  price?: {
    value: number
    currency: string
    raw: string
  }
  rating?: number
  reviews?: number
  source?: string
  thumbnail?: string
}

export interface GoogleShoppingResult {
  search_metadata: {
    id: string
    status: string
    created_at: string
    processed_at?: string
    total_time_taken?: number
  }
  search_parameters: {
    engine: string
    q: string
    location?: string
    num?: number
  }
  shopping_results?: GoogleShoppingProduct[]
  error?: string
}

export interface ScrapingResult {
  success: boolean
  url: string
  content?: string
  markdown?: string
  error?: string
  metadata?: {
    title?: string
    description?: string
    statusCode?: number
  }
}

// ============================================================================
// Configuration
// ============================================================================

const SOAX_SCRAPING_API_KEY = process.env.SOAX_SCRAPING_API_KEY
const SOAX_SERP_API_KEY = process.env.SOAX_SERP_API_KEY

const SCRAPING_BASE_URL = 'https://scraping.soax.com/v1/webdata/fetch-content'
const SERP_BASE_URL = 'https://scraping.soax.com/v1/serp'

// Rate limiting (简单延迟)
const REQUEST_DELAY_MS = 1000

let lastRequestTime = 0

async function applyRateLimit(): Promise<void> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime

  if (timeSinceLastRequest < REQUEST_DELAY_MS) {
    const delay = REQUEST_DELAY_MS - timeSinceLastRequest
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  lastRequestTime = Date.now()
}

// ============================================================================
// SERP API - Google Shopping
// ============================================================================

export interface SearchGoogleShoppingOptions {
  location?: string // e.g., "United States"
  num?: number // Number of results (1-100)
  timeout?: number // Request timeout in ms
}

export async function searchGoogleShopping(
  query: string,
  options: SearchGoogleShoppingOptions = {}
): Promise<GoogleShoppingResult> {
  if (!SOAX_SERP_API_KEY) {
    throw new Error('SOAX_SERP_API_KEY not configured')
  }

  await applyRateLimit()

  const { location = 'United States', num = 20, timeout = 30000 } = options

  const url = new URL(`${SERP_BASE_URL}/google/shopping`)
  url.searchParams.set('api_key', SOAX_SERP_API_KEY)
  url.searchParams.set('q', query)
  url.searchParams.set('location', location)
  url.searchParams.set('num', num.toString())

  logger.info('SOAX SERP API request', { query, location, num })

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('SOAX SERP API error', {
        status: response.status,
        error: errorText,
      })
      throw new Error(`SOAX SERP API error: ${response.status} - ${errorText}`)
    }

    const data = (await response.json()) as GoogleShoppingResult

    logger.info('SOAX SERP API success', {
      query,
      resultsCount: data.shopping_results?.length || 0,
    })

    return data
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('SOAX SERP API timeout', { query, timeout })
      throw new Error(`SOAX SERP API timeout after ${timeout}ms`)
    }

    logger.error('SOAX SERP API request failed', {
      query,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

// ============================================================================
// Web Scraping API
// ============================================================================

export interface FetchWebContentOptions {
  country?: string // ISO 3166-1 alpha-2 code, e.g., "US"
  markdown?: boolean // Return markdown instead of HTML
  timeout?: number // Request timeout in ms
}

export async function fetchWebContent(
  url: string,
  options: FetchWebContentOptions = {}
): Promise<ScrapingResult> {
  if (!SOAX_SCRAPING_API_KEY) {
    throw new Error('SOAX_SCRAPING_API_KEY not configured')
  }

  await applyRateLimit()

  const { country = 'US', markdown = false, timeout = 30000 } = options

  logger.info('SOAX Scraping API request', { url, country, markdown })

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(SCRAPING_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SOAX_SCRAPING_API_KEY,
      },
      body: JSON.stringify({
        url,
        country,
        render_js: false,
        format: markdown ? 'markdown' : 'html',
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('SOAX Scraping API error', {
        status: response.status,
        error: errorText,
      })

      return {
        success: false,
        url,
        error: `HTTP ${response.status}: ${errorText}`,
      }
    }

    const data = await response.json()

    logger.info('SOAX Scraping API success', { url })

    return {
      success: true,
      url,
      content: data.html || data.content,
      markdown: data.markdown,
      metadata: {
        title: data.title,
        description: data.description,
        statusCode: data.status_code,
      },
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('SOAX Scraping API timeout', { url, timeout })
      return {
        success: false,
        url,
        error: `Timeout after ${timeout}ms`,
      }
    }

    logger.error('SOAX Scraping API request failed', {
      url,
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      success: false,
      url,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 验证 SOAX API 配置
 */
export function isSoaxConfigured(): {
  scraping: boolean
  serp: boolean
} {
  return {
    scraping: !!SOAX_SCRAPING_API_KEY,
    serp: !!SOAX_SERP_API_KEY,
  }
}

/**
 * 从 Google Shopping 结果中提取产品信息
 */
export function extractProductInfo(result: GoogleShoppingResult): {
  products: Array<{
    title: string
    price?: number
    rating?: number
    source?: string
  }>
  totalResults: number
} {
  const products =
    result.shopping_results?.map((item) => ({
      title: item.title,
      price: item.price?.value,
      rating: item.rating,
      source: item.source,
    })) || []

  return {
    products,
    totalResults: products.length,
  }
}
