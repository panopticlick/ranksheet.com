import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { Container } from '@/components/Container'
import { FAQ, type FAQItem } from '@/components/FAQ'
import { MarketBrief } from '@/components/MarketBrief'
import { MarketTakeaways } from '@/components/MarketTakeaways'
import { Methodology } from '@/components/Methodology'
import { PeriodSelect } from '@/components/PeriodSelect'
import { ProductImage } from '@/components/ProductImage'
import { RelativeTime } from '@/components/RelativeTime'
import { RankTrajectory } from '@/components/RankTrajectory'
import { RankSheetClient } from '@/components/RankSheetClient'
import { RelatedSheets } from '@/components/RelatedSheets'
import { TopMovers } from '@/components/TopMovers'
import { amazonProductUrl } from '@/lib/amazon/url'
import { getPublicSheetBySlug } from '@/lib/cms/public'
import { env } from '@/lib/env'
import { CATEGORIES, type CategoryKey, getCategoryLabel } from '@/lib/ranksheet/categories'
import { buildGoToAmazonPath } from '@/lib/ranksheet/go'

export const revalidate = 600 // Reduced from 3600 to 10 minutes

const getSheetCached = cache(async (slug: string, period?: string | null) => {
  return await getPublicSheetBySlug(slug, { period: period ?? null, periodsLimit: 18 }, { revalidateSeconds: 600 })
})

export async function generateStaticParams() {
  try {
    const response = await fetch(`${env.CMS_PUBLIC_URL}/api/public/keywords?indexable=true&limit=1000`, {
      next: { revalidate: 3600 },
    })

    if (!response.ok) {
      console.warn('Failed to fetch keywords for generateStaticParams')
      return []
    }

    const data = await response.json()

    return (
      data.items?.map((keyword: { slug: string }) => ({
        slug: keyword.slug,
      })) ?? []
    )
  } catch (error) {
    console.error('Error in generateStaticParams:', error)
    return []
  }
}

function isoDate(input: string | null | undefined): string | null {
  if (!input) return null
  const d = new Date(input)
  if (!Number.isFinite(d.valueOf())) return null
  return d.toISOString().slice(0, 10)
}

function volatilityLabel(rows: { trendDelta: number }[]): 'Low' | 'High' {
  if (rows.length === 0) return 'Low'
  const avgAbs = rows.reduce((sum, r) => sum + Math.abs(r.trendDelta ?? 0), 0) / rows.length
  return avgAbs >= 2 ? 'High' : 'Low'
}

function buildFaq(keyword: string): FAQItem[] {
  return [
    {
      q: `What are the most popular ${keyword} right now?`,
      a: `RankSheet ranks products for “${keyword}” using normalized indices derived from aggregated Amazon US shopper behavior. Check the Top 10 list above for the current period.`,
    },
    {
      q: `How does RankSheet calculate the score?`,
      a: `We combine a normalized popularity signal, a normalized buyer-intent signal, and recent rank movement into a 1–100 RankSheet Score. We never display raw percentage shares.`,
    },
    {
      q: `Do you show prices or availability?`,
      a: `No. RankSheet focuses on rankings and normalized indices, not real-time offers. Always confirm price and availability directly on Amazon.`,
    },
  ]
}

function parsePeriodParam(input: unknown): string | null {
  const raw = Array.isArray(input) ? input[0] : input
  const v = typeof raw === 'string' ? raw.trim() : ''
  if (!v) return null
  return /^\d{4}-\d{2}(?:-\d{2})?$/.test(v) ? v : null
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const params = await props.params
  const searchParams = await props.searchParams
  const slug = params.slug
  const requestedPeriod = parsePeriodParam(searchParams.period)
  const data = await getSheetCached(slug, requestedPeriod).catch(() => null)
  if (!data) return { title: 'Not found' }

  const keyword = data.keyword.keyword
  const title = data.keyword.title ?? `The 10 Best ${keyword} (Ranked by Shopper Demand)`
  const description =
    data.keyword.description ??
    `We analyze aggregated Amazon US search-term data for “${keyword}” to understand what shoppers click and buy—without exposing raw percentage shares.`

  const latestPeriod = data.availablePeriods?.[0]?.dataPeriod ?? null
  const isHistorical =
    !!requestedPeriod && !!data.sheet?.dataPeriod && !!latestPeriod && data.sheet.dataPeriod !== latestPeriod

  const noindex = !data.keyword.indexable || !data.sheet || isHistorical

  // Historical snapshots always canonical to current version
  const canonicalUrl = isHistorical ? `${env.SITE_URL}/${encodeURIComponent(slug)}` : `${env.SITE_URL}/${encodeURIComponent(slug)}`

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    robots: noindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonicalUrl, // OG URL should match canonical for historical snapshots
      type: 'article',
      // Don't generate period-specific OG images for historical snapshots
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function SheetPage(props: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await props.params
  const searchParams = await props.searchParams
  const slug = params.slug
  const requestedPeriod = parsePeriodParam(searchParams.period)
  const data = await getSheetCached(slug, requestedPeriod).catch(() => null)
  if (!data) notFound()

  const keyword = data.keyword.keyword
  const sheetTopN = data.keyword.topN ?? 20
  const h1 = data.keyword.title ?? `Top ${sheetTopN} ${keyword} (Market Ticker)`
  const rawCategory = data.keyword.category ?? null
  const categoryKey: CategoryKey | null = CATEGORIES.some((c) => c.key === rawCategory)
    ? (rawCategory as CategoryKey)
    : null
  const categoryLabel = getCategoryLabel(categoryKey ?? rawCategory ?? undefined)

  const sheet = data.sheet
  const rows = sheet?.rows ?? []
  const updatedDate = sheet?.updatedAt ? isoDate(sheet.updatedAt) : null

  const listUrl = new URL(`/${slug}`, env.SITE_URL).toString()

  const top = rows[0] ?? null
  const topCtaUrl = top
    ? buildGoToAmazonPath({ asin: top.asin, slug, rank: top.rank, position: 'hero_cta' })
    : null

  const topMover = rows
    .filter((r) => typeof r.trendDelta === 'number' && r.trendDelta > 0)
    .sort((a, b) => b.trendDelta - a.trendDelta || a.rank - b.rank)[0]

  const vol = volatilityLabel(rows.slice(0, 10))

  const latestPeriod = data.availablePeriods?.[0]?.dataPeriod ?? null
  const isHistorical =
    !!requestedPeriod && !!sheet?.dataPeriod && !!latestPeriod && sheet.dataPeriod !== latestPeriod
  const periodMismatch =
    !!requestedPeriod &&
    !!sheet?.dataPeriod &&
    !(requestedPeriod === sheet.dataPeriod || (requestedPeriod.length === 7 && sheet.dataPeriod.startsWith(requestedPeriod)))

  const jsonLd = sheet
    ? [
        // Organization Schema
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'RankSheet',
          url: env.SITE_URL,
          logo: {
            '@type': 'ImageObject',
            url: `${env.SITE_URL}/logo.png`,
          },
          sameAs: [],
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer service',
            url: `${env.SITE_URL}/contact`,
          },
        },
        // BreadcrumbList Schema
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: new URL('/', env.SITE_URL).toString() },
            {
              '@type': 'ListItem',
              position: 2,
              name: categoryLabel,
              item: new URL(`/category/${encodeURIComponent(String(data.keyword.category ?? 'other'))}`, env.SITE_URL).toString(),
            },
            { '@type': 'ListItem', position: 3, name: keyword, item: listUrl },
          ],
        },
        // Article Schema
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: h1,
          description: data.keyword.description ?? `RankSheet analysis for "${keyword}" on Amazon US market`,
          datePublished: data.keyword.createdAt ?? new Date().toISOString(),
          dateModified: sheet.updatedAt ?? data.keyword.createdAt ?? new Date().toISOString(),
          author: {
            '@type': 'Organization',
            name: 'RankSheet',
            url: env.SITE_URL,
          },
          publisher: {
            '@type': 'Organization',
            name: 'RankSheet',
            url: env.SITE_URL,
            logo: {
              '@type': 'ImageObject',
              url: `${env.SITE_URL}/logo.png`,
            },
          },
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': listUrl,
          },
        },
        // ItemList Schema with enhanced Product details
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: `RankSheet: ${keyword}`,
          description: `Top ${sheetTopN} products for "${keyword}" based on aggregated Amazon US shopper behavior`,
          url: listUrl,
          numberOfItems: rows.slice(0, 10).length,
          itemListElement: rows.slice(0, 10).map((r) => ({
            '@type': 'ListItem',
            position: r.rank,
            item: {
              '@type': 'Product',
              name: r.title,
              image: r.image,
              brand: { '@type': 'Brand', name: r.brand },
              url: amazonProductUrl({ asin: r.asin }),
              sku: r.asin,
              identifier: r.asin,
              offers: {
                '@type': 'AggregateOffer',
                availability: 'https://schema.org/InStock',
                priceCurrency: 'USD',
                seller: {
                  '@type': 'Organization',
                  name: 'Amazon',
                },
              },
              aggregateRating: r.score
                ? {
                    '@type': 'AggregateRating',
                    ratingValue: (r.score / 20).toFixed(1),
                    bestRating: '5',
                    worstRating: '1',
                    ratingCount: 1,
                  }
                : undefined,
            },
          })),
        },
        // HowTo Schema for methodology
        {
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: `How to Find the Best ${keyword}`,
          description: `Learn how RankSheet ranks products for "${keyword}" using normalized indices from aggregated Amazon shopper data`,
          step: [
            {
              '@type': 'HowToStep',
              name: 'Analyze Aggregated Data',
              text: 'We collect aggregated Amazon US search-term behavioral data to understand shopper patterns.',
            },
            {
              '@type': 'HowToStep',
              name: 'Calculate Normalized Indices',
              text: 'Raw data is transformed into normalized popularity and buyer-intent indices, never exposing raw percentages.',
            },
            {
              '@type': 'HowToStep',
              name: 'Score and Rank Products',
              text: 'Products are scored (1-100) combining popularity, intent, and trend movement to create the final RankSheet.',
            },
          ],
        },
        // FAQPage Schema
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: buildFaq(keyword).map((i) => ({
            '@type': 'Question',
            name: i.q,
            acceptedAnswer: { '@type': 'Answer', text: i.a },
          })),
        },
      ]
    : []

  return (
    <div className="pb-12">
      <section className="pt-8">
        <Container>
          <div className="grid gap-5 lg:grid-cols-[1.25fr,0.75fr] lg:items-start">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {categoryKey ? (
                  <Link
                    href={`/category/${encodeURIComponent(String(categoryKey))}`}
                    className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                  >
                    {categoryLabel}
                  </Link>
                ) : (
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {categoryLabel}
                  </div>
                )}
                <span className="rounded bg-zinc-900 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white dark:bg-white dark:text-black">
                  Market Ticker
                </span>
                {isHistorical ? (
                  <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">
                    Snapshot
                  </span>
                ) : null}
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
                {h1}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                Aggregated Amazon US shopper behavior, normalized into indices — built for fast comparisons and high‑intent clicks.
              </p>

              <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-200">Data period:</span>
                  <PeriodSelect slug={slug} periods={data.availablePeriods ?? []} currentPeriod={sheet?.dataPeriod ?? null} />
                </div>
                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                <span>
                  Updated:{' '}
                  <RelativeTime
                    iso={sheet?.updatedAt ?? null}
                    fallback={updatedDate ?? '—'}
                    title={updatedDate ?? undefined}
                    className="font-semibold text-zinc-900 dark:text-zinc-50"
                  />
                </span>
              </div>

              {periodMismatch ? (
                <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  Requested <span className="font-mono font-semibold">{requestedPeriod ?? '—'}</span> is unavailable. Showing{' '}
                  <span className="font-mono font-semibold">{sheet?.dataPeriod ?? 'current'}</span>.{' '}
                  <Link href={`/${encodeURIComponent(slug)}`} className="font-semibold underline underline-offset-2">
                    Back to current
                  </Link>
                </div>
              ) : isHistorical ? (
                <div className="mt-2 text-xs text-blue-700 dark:text-blue-200">
                  Viewing a historical snapshot as of <span className="font-mono font-semibold">{sheet?.dataPeriod ?? '—'}</span>.{' '}
                  <Link href={`/${encodeURIComponent(slug)}`} className="font-semibold underline underline-offset-2">
                    Back to current
                  </Link>
                </div>
              ) : null}

              {topCtaUrl ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <a
                    href={topCtaUrl}
                    target="_blank"
                    rel="nofollow sponsored noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-black shadow-sm hover:bg-amber-500"
                  >
                    Check #1 on Amazon ➔
                  </a>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">No real‑time prices shown. Verify details on Amazon.</span>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Dominance
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                      IDX {top?.marketShareIndex ?? '—'}
                    </div>
                    <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Rank #1 share index</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {top ? (
                      <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-black/10 bg-zinc-100 dark:border-white/10 dark:bg-white/10">
                        <ProductImage
                          src={top.image}
                          alt={top.title}
                          categoryKey={categoryKey}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      </div>
                    ) : null}
                    <div className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      #{top?.rank ?? '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Volatility
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="font-mono text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{vol}</div>
                  <div
                    className={
                      vol === 'High'
                        ? 'rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                        : 'rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                    }
                    title="Based on average absolute rank movement for the current Top 10."
                  >
                    Top 10
                  </div>
                </div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">How turbulent the list is</div>
              </div>

              <div className="rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Top mover
                </div>
                {topMover ? (
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="line-clamp-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {topMover.title}
                      </div>
                      <div className="mt-1 font-mono text-xs text-emerald-700 dark:text-emerald-300">
                        ▲ {topMover.trendDelta} positions
                      </div>
                    </div>
                    <div className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      Rising
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">No strong risers this period.</div>
                )}
              </div>
            </div>
          </div>

          {!sheet ? (
            <div className="mt-8 rounded-2xl border border-black/5 bg-white p-6 text-sm text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
              <div className="font-semibold text-zinc-900 dark:text-zinc-50">Warming up…</div>
              <div className="mt-1 leading-6">
                We’re preparing product details for this keyword. Please check back soon, or explore related sheets
                below.
              </div>
            </div>
          ) : (
            <>
              <MarketBrief keyword={keyword} dataPeriod={sheet.dataPeriod} rows={rows} />
              <MarketTakeaways slug={slug} keyword={keyword} rows={rows} />
              <TopMovers slug={slug} rows={rows} categoryKey={categoryKey} />
              <RankSheetClient slug={slug} keyword={keyword} mode={sheet.mode} rows={rows} asOfPeriod={sheet.dataPeriod} />
              <RankTrajectory slug={slug} asOfPeriod={sheet.dataPeriod} />
            </>
          )}
        </Container>
      </section>

      <Methodology keyword={keyword} />
      <RelatedSheets items={data.related} categoryKey={data.keyword.category ?? null} categoryLabel={categoryLabel} />
      <FAQ items={buildFaq(keyword)} />

      {jsonLd.length > 0 ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      ) : null}
    </div>
  )
}
