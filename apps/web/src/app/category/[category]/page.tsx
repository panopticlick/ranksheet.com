import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { clsx } from 'clsx'

import { Container } from '@/components/Container'
import { FAQ, type FAQItem } from '@/components/FAQ'
import { ProductImage } from '@/components/ProductImage'
import { TickerTrendSparkline } from '@/components/TickerTrendSparkline'
import { TrendPill } from '@/components/TrendPill'
import { getPublicCategoryHighlights, getPublicCategoryTickers } from '@/lib/cms/public'
import { env } from '@/lib/env'
import { CATEGORIES, type CategoryKey, getCategoryLabel } from '@/lib/ranksheet/categories'

export const revalidate = 1800 // 30 minutes (balanced for category pages)

const PAGE_SIZE = 50

export async function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.key }))
}

function isoDate(input: string | null | undefined): string {
  if (!input) return '—'
  const d = new Date(input)
  if (!Number.isFinite(d.valueOf())) return '—'
  return d.toISOString().slice(0, 10)
}

function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value
  const n = Number.parseInt((raw ?? '1').trim(), 10)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, 1000)
}

function buildSectorFaq(label: string): FAQItem[] {
  return [
    {
      q: `What is the ${label} sector dashboard?`,
      a: `This page aggregates all active RankSheet “market tickers” in ${label}. Use it to scan which markets are active, what’s moving, and which products lead each ticker.`,
    },
    {
      q: 'How often is this updated?',
      a: 'Each ticker updates when new data arrives. Use the period and updated timestamp shown per market to gauge freshness.',
    },
    {
      q: 'Do you show prices or availability?',
      a: 'No. RankSheet focuses on rankings and normalized indices, not real-time offers. Always confirm price and availability directly on Amazon.',
    },
  ]
}

export async function generateMetadata(props: {
  params: Promise<{ category: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams])
  const key = params.category as CategoryKey
  const label = getCategoryLabel(key)
  const page = parsePageParam(searchParams.page)
  const canonicalBase = `/category/${encodeURIComponent(params.category)}`
  const canonical = page > 1 ? `${canonicalBase}?page=${page}` : canonicalBase
  const title = page > 1 ? `${label} Sector Dashboard — Page ${page}` : `${label} Sector Dashboard`
  const description =
    page > 1
      ? `Page ${page} of the ${label} sector dashboard — scan more active tickers, leaders, and trend movement across RankSheet.`
      : `A market dashboard for ${label} — track active tickers, leaders, and trend movement across RankSheet.`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
    },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function CategoryPage(props: {
  params: Promise<{ category: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams])
  const key = params.category as CategoryKey
  const known = CATEGORIES.some((c) => c.key === key)
  if (!known) notFound()

  const label = getCategoryLabel(key)
  const page = parsePageParam(searchParams.page)
  const isFirstPage = page === 1
  const offset = (page - 1) * PAGE_SIZE

  const [tickersData, highlights] = await Promise.all([
    getPublicCategoryTickers({ category: key, limit: PAGE_SIZE, offset }, { revalidateSeconds: 3600 }).catch(() => null),
    isFirstPage ? getPublicCategoryHighlights({ category: key }, { revalidateSeconds: 3600 }).catch(() => null) : null,
  ])

  const recentlyUpdated = highlights?.recentlyUpdated ?? []
  const hotThisWeek = highlights?.hotThisWeek ?? []

  const tracking = tickersData?.tracking ?? 0
  const tickers = tickersData?.tickers ?? []
  const topGainer = tickersData?.topGainer ?? null
  const mostVolatile = tickersData?.mostVolatile ?? null

  const totalPages = tracking > 0 ? Math.max(1, Math.ceil(tracking / PAGE_SIZE)) : 1
  if (tickersData && (page > totalPages || (page > 1 && tickers.length === 0))) notFound()

  const canonicalPath = page > 1 ? `/category/${encodeURIComponent(key)}?page=${page}` : `/category/${encodeURIComponent(key)}`
  const canonicalUrl = new URL(canonicalPath, env.SITE_URL).toString()
  const faqItems = buildSectorFaq(label)
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: new URL('/', env.SITE_URL).toString() },
        { '@type': 'ListItem', position: 2, name: label, item: canonicalUrl },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: page > 1 ? `${label} Sector Dashboard — Page ${page}` : `${label} Sector Dashboard`,
      url: canonicalUrl,
      itemListElement: tickers.slice(0, 20).map((t, idx) => ({
        '@type': 'ListItem',
        position: offset + idx + 1,
        item: { '@type': 'WebPage', name: t.title, url: new URL(`/${t.slug}`, env.SITE_URL).toString() },
      })),
    },
    ...(isFirstPage
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqItems.map((i) => ({
              '@type': 'Question',
              name: i.q,
              acceptedAnswer: { '@type': 'Answer', text: i.a },
            })),
          },
        ]
      : []),
  ]

  return (
    <div className="py-10">
      <Container>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {isFirstPage ? 'Sector dashboard' : `Sector dashboard • Page ${page}`}
            </div>
            {!isFirstPage ? (
              <Link
                href={`/category/${encodeURIComponent(key)}`}
                className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
              >
                Back to page 1 →
              </Link>
            ) : null}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {label}
            {!isFirstPage ? <span className="text-zinc-500 dark:text-zinc-400"> — Page {page}</span> : null}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            Macro snapshot for {label}: active tickers, category movers, and leader products — built from aggregated Amazon US shopper behavior.
          </p>
        </div>

        <div className={clsx('mt-8 grid gap-3', isFirstPage ? 'lg:grid-cols-3' : 'lg:grid-cols-2')}>
          <div className="rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-white/5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Market cap
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              Tracking {tracking || tickers.length} Markets
            </div>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Active, indexable tickers in this sector.</div>
          </div>

          {isFirstPage ? (
            <div className="rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-white/5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Top gainer
              </div>
              {topGainer ? (
                <Link href={`/${topGainer.slug}`} className="mt-2 block group">
                  <div className="line-clamp-1 text-sm font-semibold text-zinc-900 group-hover:underline dark:text-zinc-50">
                    {topGainer.title}
                  </div>
                  <div className="mt-1 font-mono text-xs text-emerald-700 dark:text-emerald-300">
                    ▲ {topGainer.maxRise ?? 0} positions (Top 10)
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Based on rank movement within the latest refresh.
                  </div>
                </Link>
              ) : (
                <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Not enough data yet.</div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-white/5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Browse
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                Page {page} / {totalPages}
              </div>
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Use pagination below, or open page 1 for sector highlights.
              </div>
            </div>
          )}

          {isFirstPage ? (
            <div className="rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-white/5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Most volatile
              </div>
              {mostVolatile ? (
                <Link href={`/${mostVolatile.slug}`} className="mt-2 block group">
                  <div className="line-clamp-1 text-sm font-semibold text-zinc-900 group-hover:underline dark:text-zinc-50">
                    {mostVolatile.title}
                  </div>
                  <div className="mt-1 font-mono text-xs text-rose-700 dark:text-rose-300">
                    VOL {typeof mostVolatile.volatility === 'number' ? mostVolatile.volatility.toFixed(1) : '—'}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Average absolute Top 10 movement.</div>
                </Link>
              ) : (
                <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Not enough data yet.</div>
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-6 rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">How to use this dashboard</div>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            Open any market to see the full Top list, indices, and trend sparklines. Use{' '}
            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-50">Cmd/Ctrl + K</span> to jump to any ticker instantly.
          </p>
        </div>

        <div className="mt-10 flex items-end justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Ticker tape</div>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Markets in {label}, with leader + update + trend.</div>
            {totalPages > 1 ? (
              <div className="mt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                Page {page} / {totalPages} • Showing {tracking ? offset + 1 : 0}-{Math.min(offset + tickers.length, tracking || tickers.length)} of{' '}
                {tracking || tickers.length}
              </div>
            ) : null}
          </div>
          <Link
            href="/requests"
            className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10"
          >
            Request a ticker
          </Link>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-white/5">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-zinc-50 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:bg-white/5 dark:text-zinc-300">
                <tr>
                  <th className="px-3 py-2">Market</th>
                  <th className="px-3 py-2">Leader (#1)</th>
                  <th className="px-3 py-2">Update</th>
                  <th className="px-3 py-2">Trend</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                {tickers.map((t) => {
                  const leader = t.leader
                  const updated = t.updatedAt ?? t.lastRefreshedAt ?? null
                  return (
                    <tr key={t.slug} className="group hover:bg-blue-50/30 dark:hover:bg-white/5">
                      <td className="px-3 py-3 align-top">
                        <Link href={`/${t.slug}`} className="block">
                          <div className="line-clamp-1 font-semibold text-zinc-900 group-hover:underline dark:text-zinc-50">
                            {t.title}
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">/{t.slug}</div>
                        </Link>
                      </td>

                      <td className="px-3 py-3 align-top">
                        {leader ? (
                          <div className="flex items-start gap-3">
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-black/10 bg-zinc-100 dark:border-white/10 dark:bg-white/10">
                              <ProductImage
                                src={leader.image}
                                alt={leader.title}
                                categoryKey={key}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="line-clamp-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                {leader.title}
                              </div>
                              <div className="mt-0.5 line-clamp-1 text-xs text-zinc-600 dark:text-zinc-300">{leader.brand}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-zinc-600 dark:text-zinc-300">Updating…</div>
                        )}
                      </td>

                      <td className="px-3 py-3 align-top font-mono text-xs text-zinc-600 dark:text-zinc-300">
                        <div>{t.dataPeriod ?? '—'}</div>
                        <div className="mt-0.5 text-zinc-500 dark:text-zinc-400">Updated {isoDate(updated)}</div>
                      </td>

                      <td className="px-3 py-3 align-top">
                        {leader ? (
                          <div className="flex items-center gap-2">
                            <TickerTrendSparkline slug={t.slug} fallbackDelta={leader.trendDelta} className="shrink-0" />
                            <TrendPill delta={leader.trendDelta} label={leader.trendLabel} />
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">—</span>
                        )}
                      </td>

                      <td className="px-3 py-3 align-top text-right">
                        <Link
                          href={`/${t.slug}`}
                          className="inline-flex items-center justify-center rounded-full bg-amber-400 px-3 py-1.5 text-xs font-bold text-black shadow-sm hover:bg-amber-500"
                        >
                          Open ➔
                        </Link>
                      </td>
                    </tr>
                  )
                })}

                {tickers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-zinc-600 dark:text-zinc-300">
                      No tickers yet for this sector. Check back soon, or request one.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-zinc-600 dark:text-zinc-300">
              Browse more markets in {label}.
            </div>

            <div className="flex items-center gap-2">
              <Link
                aria-disabled={page <= 1}
                tabIndex={page <= 1 ? -1 : 0}
                href={page <= 1 ? canonicalPath : page === 2 ? `/category/${encodeURIComponent(key)}` : `/category/${encodeURIComponent(key)}?page=${page - 1}`}
                className={
                  page <= 1
                    ? 'pointer-events-none rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-400 dark:border-white/10 dark:bg-white/5 dark:text-zinc-500'
                    : 'rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10'
                }
              >
                ← Prev
              </Link>

              <div className="flex items-center gap-1">
                {(() => {
                  const candidates = [1, page - 1, page, page + 1, totalPages]
                  const pages = Array.from(new Set(candidates))
                    .filter((p) => p >= 1 && p <= totalPages)
                    .sort((a, b) => a - b)

                  const out: ReactNode[] = []
                  for (let i = 0; i < pages.length; i += 1) {
                    const p = pages[i]!
                    const prev = pages[i - 1] ?? null
                    if (prev != null && p - prev > 1) {
                      out.push(
                        <span key={`gap-${prev}-${p}`} className="px-1 text-xs text-zinc-400 dark:text-zinc-500">
                          …
                        </span>,
                      )
                    }

                    const href = p === 1 ? `/category/${encodeURIComponent(key)}` : `/category/${encodeURIComponent(key)}?page=${p}`
                    out.push(
                      <Link
                        key={p}
                        href={href}
                        className={
                          p === page
                            ? 'rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white dark:bg-white dark:text-black'
                            : 'rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10'
                        }
                      >
                        {p}
                      </Link>,
                    )
                  }

                  return out
                })()}
              </div>

              <Link
                aria-disabled={page >= totalPages}
                tabIndex={page >= totalPages ? -1 : 0}
                href={page >= totalPages ? canonicalPath : `/category/${encodeURIComponent(key)}?page=${page + 1}`}
                className={
                  page >= totalPages
                    ? 'pointer-events-none rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-400 dark:border-white/10 dark:bg-white/5 dark:text-zinc-500'
                    : 'rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10'
                }
              >
                Next →
              </Link>
            </div>
          </div>
        ) : null}

        {isFirstPage && (recentlyUpdated.length > 0 || hotThisWeek.length > 0) ? (
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-white/5">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Updated this week</div>
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Fresh sheets in {label}.</div>
              <div className="mt-4 grid gap-2">
                {recentlyUpdated.slice(0, 6).map((k) => (
                  <Link
                    key={k.slug}
                    href={`/${k.slug}`}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-white px-4 py-3 hover:bg-zinc-50 dark:border-white/10 dark:bg-black/20 dark:hover:bg-white/5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-900 group-hover:underline dark:text-zinc-50">
                        {k.keyword}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                        {k.lastRefreshedAt ? `Updated ${new Date(k.lastRefreshedAt).toLocaleDateString()}` : 'Updating'}
                      </div>
                    </div>
                    <div className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      New
                    </div>
                  </Link>
                ))}

                {recentlyUpdated.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-white p-4 text-sm text-zinc-600 dark:border-white/10 dark:bg-black/20 dark:text-zinc-300">
                    No updates yet this week.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-white/5">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Hot this week</div>
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Sheets getting the most engagement.</div>
              <div className="mt-4 grid gap-2">
                {hotThisWeek.slice(0, 6).map((k) => (
                  <Link
                    key={k.slug}
                    href={`/${k.slug}`}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-white px-4 py-3 hover:bg-zinc-50 dark:border-white/10 dark:bg-black/20 dark:hover:bg-white/5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-900 group-hover:underline dark:text-zinc-50">
                        {k.keyword}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                        {k.lastRefreshedAt ? `Updated ${new Date(k.lastRefreshedAt).toLocaleDateString()}` : 'Updating'}
                      </div>
                    </div>
                    <div className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                      Rising
                    </div>
                  </Link>
                ))}

                {hotThisWeek.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-white p-4 text-sm text-zinc-600 dark:border-white/10 dark:bg-black/20 dark:text-zinc-300">
                    Not enough data yet. Check back after more traffic.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-12 rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Explore categories</div>
          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Jump between topic clusters.</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Link
                key={c.key}
                href={`/category/${encodeURIComponent(c.key)}`}
                className={
                  c.key === key
                    ? 'rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-black'
                    : 'rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10'
                }
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>

      </Container>

      {isFirstPage ? <FAQ items={faqItems} /> : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  )
}
