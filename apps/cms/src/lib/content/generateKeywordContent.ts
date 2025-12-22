import * as llm from '@/lib/external/llmClient'
import { getKeywordsEverywhereClient } from '@/lib/external/keywordsEverywhereClient'
import { logger } from '@/lib/logger'

export interface KeywordContentContext {
  category?: string
  topProducts?: Array<{
    title: string
    brand?: string
    price?: number
    rating?: number
  }>
}

export interface GeneratedContent {
  title: string
  description: string
  marketBrief?: string
  faq?: Array<{ question: string; answer: string }>
  relatedKeywords?: string[]
}

/**
 * Generate AI-powered content for a keyword using LLM
 */
export async function generateKeywordContent(
  keyword: string,
  context?: KeywordContentContext
): Promise<GeneratedContent> {
  if (!llm.isLlmConfigured()) {
    throw new Error('LLM client not configured')
  }

  try {
    // Get related keywords if API is configured
    let relatedKeywords: string[] = []
    const kwClient = getKeywordsEverywhereClient()
    if (kwClient.isConfigured()) {
      try {
        const related = await kwClient.getRelatedKeywords(keyword)
        relatedKeywords = related.slice(0, 10).map((r) => r.keyword)
      } catch (error) {
        logger.warn({ error }, 'related_keywords_fetch_failed')
      }
    }

    // Generate title
    const titlePrompt = `Generate a compelling H1 title for "${keyword}" rankings. 50-60 chars, include keyword.`
    const generatedTitle = await llm.generateCreativeContent(titlePrompt)

    // Generate meta description
    const descPrompt = `Write meta description for "${keyword}" rankings page. 150-160 chars.`
    const generatedDescription = await llm.generateCreativeContent(descPrompt)

    // Generate market brief if we have product context
    let marketBrief: string | undefined
    if (context?.topProducts && context.topProducts.length > 0) {
      const productsText = context.topProducts
        .slice(0, 5)
        .map((p, i) => `${i + 1}. ${p.title}`)
        .join(', ')
      const briefPrompt = `Analyze "${keyword}" market. Top products: ${productsText}. Write 2-3 sentence overview.`
      marketBrief = await llm.generateAnalysis(briefPrompt)
    }

    // Generate FAQs
    const faqPrompt = `Generate 3 FAQs about "${keyword}". Format as JSON array: [{"question": "...", "answer": "..."}]`
    const faqText = await llm.generateCreativeContent(faqPrompt)

    let faq: Array<{ question: string; answer: string }> = []
    try {
      const parsed = JSON.parse(faqText)
      if (Array.isArray(parsed)) {
        faq = parsed.filter((item) => item.question && item.answer)
      }
    } catch (error) {
      // Fallback FAQ
      faq = [
        {
          question: `What are the best ${keyword}?`,
          answer: `Check our rankings above for the top ${keyword} based on aggregated data.`,
        },
      ]
    }

    return {
      title: generatedTitle.trim().replace(/^["']|["']$/g, ''),
      description: generatedDescription.trim().replace(/^["']|["']$/g, ''),
      marketBrief: marketBrief?.trim(),
      faq,
      relatedKeywords,
    }
  } catch (error) {
    logger.error({ error, keyword }, 'generate_keyword_content_failed')
    throw error
  }
}

/**
 * Generate simple fallback content without LLM
 */
export function generateSimpleContent(
  keyword: string,
  context?: KeywordContentContext
): GeneratedContent {
  const category = context?.category || 'products'

  return {
    title: `Best ${keyword} - Data-Driven Rankings`,
    description: `Discover the best ${keyword} based on aggregated Amazon search behavior. Updated rankings of top ${category}.`,
    marketBrief: `Our ${keyword} rankings are based on real shopper behavior data.`,
    faq: [
      {
        question: `What are the best ${keyword}?`,
        answer: `Check our rankings above for the top ${keyword} based on aggregated data.`,
      },
    ],
    relatedKeywords: [],
  }
}
