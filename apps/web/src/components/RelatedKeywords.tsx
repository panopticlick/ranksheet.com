'use client'

import Link from 'next/link'
import { Container } from '@/components/Container'

// ============================================================================
// Types
// ============================================================================

export interface RelatedKeywordItem {
  keyword: string
  slug?: string // If sheet exists
  volume?: number // Search volume
  isAvailable: boolean // Whether sheet exists
}

export interface RelatedKeywordsProps {
  keyword: string
  relatedItems: RelatedKeywordItem[]
  title?: string
  description?: string
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Format large numbers (e.g., 1000 -> 1K, 1000000 -> 1M)
 */
function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(1)}M`
  }
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}K`
  }
  return volume.toString()
}

/**
 * Group items by availability
 */
function groupItems(items: RelatedKeywordItem[]): {
  available: RelatedKeywordItem[]
  unavailable: RelatedKeywordItem[]
} {
  const available = items.filter((item) => item.isAvailable)
  const unavailable = items.filter((item) => !item.isAvailable)

  return { available, unavailable }
}

// ============================================================================
// Components
// ============================================================================

/**
 * Available keyword item (has sheet)
 */
function AvailableKeywordItem({ item }: { item: RelatedKeywordItem }) {
  if (!item.slug) return null

  return (
    <Link
      href={`/${item.slug}`}
      className="group rounded-2xl border border-black/5 bg-white p-4 hover:bg-blue-50/30 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm font-semibold text-zinc-900 group-hover:underline dark:text-zinc-50">
            Best {item.keyword}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            {item.volume && (
              <>
                <span>{formatVolume(item.volume)} searches</span>
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
              </>
            )}
            <span className="truncate">/{item.slug}</span>
          </div>
        </div>

        <div className="shrink-0 text-amber-700 dark:text-amber-300">
          <svg
            className="h-5 w-5 transition-transform group-hover:translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
      </div>
    </Link>
  )
}

/**
 * Unavailable keyword item (no sheet yet)
 */
function UnavailableKeywordItem({ item }: { item: RelatedKeywordItem }) {
  return (
    <Link
      href={`/requests?keyword=${encodeURIComponent(item.keyword)}`}
      className="group rounded-2xl border border-dashed border-black/10 bg-white/50 p-4 hover:border-blue-300 hover:bg-blue-50/20 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-blue-500/30 dark:hover:bg-white/5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">{item.keyword}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            {item.volume && (
              <>
                <span>{formatVolume(item.volume)} searches</span>
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
              </>
            )}
            <span className="text-amber-600 dark:text-amber-400">Request this keyword</span>
          </div>
        </div>

        <div className="shrink-0 text-zinc-400 dark:text-zinc-500">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
      </div>
    </Link>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function RelatedKeywords({
  keyword,
  relatedItems,
  title,
  description,
}: RelatedKeywordsProps) {
  const displayedItems = relatedItems.slice(0, 12)
  const { available, unavailable } = groupItems(displayedItems)

  if (displayedItems.length === 0) return null

  const defaultTitle = 'Related Product Categories'
  const defaultDescription = 'Explore similar keywords and discover more market insights.'

  return (
    <section className="border-t border-black/5 py-10 dark:border-white/10">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {title || defaultTitle}
            </h2>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              {description || defaultDescription}
            </div>
          </div>

          {available.length > 0 && unavailable.length > 0 && (
            <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full border border-blue-500 bg-blue-100 dark:bg-blue-900/50" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full border border-dashed border-zinc-400 dark:border-zinc-600" />
                <span>Request</span>
              </div>
            </div>
          )}
        </div>

        {/* Available sheets */}
        {available.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((item) => (
              <AvailableKeywordItem key={item.keyword} item={item} />
            ))}
          </div>
        )}

        {/* Unavailable keywords (show separately) */}
        {unavailable.length > 0 && (
          <>
            {available.length > 0 && (
              <div className="mt-6 border-t border-black/5 pt-6 dark:border-white/10">
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Not available yet — Request these keywords:
                </h3>
              </div>
            )}
            <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${available.length > 0 ? 'mt-3' : 'mt-4'}`}>
              {unavailable.map((item) => (
                <UnavailableKeywordItem key={item.keyword} item={item} />
              ))}
            </div>
          </>
        )}

        {/* Help text for unavailable items */}
        {unavailable.length > 0 && (
          <div className="mt-4 rounded-lg bg-amber-50/50 p-3 text-sm text-zinc-600 dark:bg-amber-900/10 dark:text-zinc-300">
            💡 Click on keywords without sheets to request them. We'll prioritize creating these market tickers based on
            community interest.
          </div>
        )}
      </Container>
    </section>
  )
}
