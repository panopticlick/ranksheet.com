import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

export interface RelatedKeyword {
  keyword: string
  vol: number
  cpc: number
  competition: number
}

export class KeywordsEverywhereClient {
  private readonly baseUrl = 'https://api.keywordseverywhere.com'
  private readonly apiKey: string

  constructor() {
    this.apiKey = env.KEYWORDS_EVERYWHERE_API_KEY ?? ''
  }

  isConfigured(): boolean {
    return !!this.apiKey
  }

  async getRelatedKeywords(keyword: string, country = 'us'): Promise<RelatedKeyword[]> {
    if (!this.isConfigured()) throw new Error('Keywords Everywhere API key not configured')

    try {
      const response = await fetch(`${this.baseUrl}/v1/get_related_keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ keyword, country, num: 10 }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API error: ${response.status} - ${errorText}`)
      }
      const data = await response.json()
      return data.data ?? []
    } catch (error) {
      logger.error({ error, keyword }, 'related_keywords_failed')
      return []
    }
  }
}

let instance: KeywordsEverywhereClient | null = null
export function getKeywordsEverywhereClient(): KeywordsEverywhereClient {
  if (!instance) instance = new KeywordsEverywhereClient()
  return instance
}

/**
 * Check if Keywords Everywhere API is configured
 */
export function isKeywordsEverywhereConfigured(): boolean {
  return !!env.KEYWORDS_EVERYWHERE_API_KEY
}

/**
 * Get keyword data (wrapper for backward compatibility)
 */
export async function getKeywordData(keywords: string[], country = 'us') {
  const client = getKeywordsEverywhereClient()

  if (!client.isConfigured()) {
    return { success: false, error: 'API key not configured' }
  }

  try {
    const data = await Promise.all(
      keywords.map(kw => client.getRelatedKeywords(kw, country))
    )
    return {
      success: true,
      data: data.flat(),
      credits_used: keywords.length
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
