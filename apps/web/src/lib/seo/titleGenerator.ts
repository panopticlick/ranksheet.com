/**
 * SEO Title Generator - Optimized for Google SERP display
 *
 * Requirements:
 * - Max 60 characters (Google cuts off ~58-60 chars)
 * - Include primary keyword
 * - Add current year for freshness signal
 * - Use action words for better CTR
 *
 * Performance Impact:
 * - Proper title length: +18-25% CTR improvement
 * - Year in title: +12% CTR for product searches
 */

export interface TitleGeneratorOptions {
  maxLength?: number
  includeYear?: boolean
  customTemplate?: string
}

export function generateOptimalTitle(
  keyword: string,
  options: TitleGeneratorOptions = {}
): string {
  const { maxLength = 60, includeYear = true } = options

  const currentYear = new Date().getFullYear()
  const yearStr = includeYear ? `[${currentYear}]` : ''

  // Template priority (try from shortest to longest to maximize keyword space)
  const templates = [
    // Template 1: Year + Best + Keyword + Ranked
    (kw: string) => `Best ${kw} ${yearStr} - Ranked by Demand`.trim(),

    // Template 2: Top + Keyword + Year + Rankings
    (kw: string) => `Top ${kw} ${yearStr} Rankings`.trim(),

    // Template 3: Keyword + Year + Market Analysis
    (kw: string) => `${kw} ${yearStr} - Market Rankings`.trim(),

    // Template 4: Simple Best + Keyword
    (kw: string) => `Best ${kw} - RankSheet`.trim(),
  ]

  // Try each template until one fits within maxLength
  for (const template of templates) {
    const title = template(keyword)
    if (title.length <= maxLength) {
      return title
    }
  }

  // Fallback: Intelligently truncate keyword if all templates exceed limit
  const truncateLength = maxLength - (includeYear ? 25 : 18) // "Best  [2025] - Ranked" = ~25 chars
  if (truncateLength > 10) {
    const truncatedKeyword = keyword.slice(0, truncateLength) + '...'
    return `Best ${truncatedKeyword} ${yearStr}`.trim()
  }

  // Ultimate fallback: keyword only
  return keyword.slice(0, maxLength)
}

/**
 * Validate title length and generate warnings
 */
export function validateTitle(title: string): {
  valid: boolean
  length: number
  warnings: string[]
} {
  const warnings: string[] = []

  if (title.length > 60) {
    warnings.push(`Title is ${title.length - 60} characters too long (will be truncated in Google)`)
  }

  if (title.length < 30) {
    warnings.push('Title is very short, consider adding more descriptive text')
  }

  if (!title.includes('[')) {
    warnings.push('Consider including the current year for freshness signal')
  }

  return {
    valid: title.length <= 60,
    length: title.length,
    warnings,
  }
}
