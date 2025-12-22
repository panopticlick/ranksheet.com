import Link from 'next/link'

import { Container } from '@/components/Container'
import { getPublicKeywords } from '@/lib/cms/public'
import { CATEGORIES } from '@/lib/ranksheet/categories'

export const revalidate = 600 // Reduced from 3600 to 10 minutes

export default async function Home() {
  const keywords = await getPublicKeywords({ limit: 60, offset: 0 }, { revalidateSeconds: 600 }).catch(() => ({
    keywords: [],
    total: 0,
  }))

  return (
    <div>
      <section className="pt-12 pb-10">
        <Container>
          <div className="grid gap-6 md:grid-cols-12 md:items-end">
            <div className="md:col-span-8">
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
                Data‑driven Amazon product rankings, built for fast decisions.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
                RankSheet analyzes aggregated Amazon US search-term behavior to understand what shoppers click and buy.
                We never display raw percentage shares—only normalized indices and trends.
              </p>
            </div>
            <div className="md:col-span-4 md:justify-self-end">
              <div className="flex flex-col gap-2 sm:flex-row md:flex-col md:items-end">
                <Link
                  href="/category/electronics"
                  className="inline-flex w-full items-center justify-center rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100 md:w-auto"
                >
                  Browse Sheets
                </Link>
                <Link
                  href="/requests"
                  className="inline-flex w-full items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10 md:w-auto"
                >
                  Request a Ticker
                </Link>
              </div>
            </div>
          </div>

          <div id="explore" className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.map((c) => (
              <Link
                key={c.key}
                href={`/category/${c.key}`}
                className="rounded-2xl border border-black/5 bg-white p-5 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{c.label}</div>
                <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{c.description}</div>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-black/5 py-10 dark:border-white/10">
        <Container>
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Latest Sheets</h2>
            <Link href="/category/electronics" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50">
              View categories →
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {keywords.keywords.slice(0, 12).map((k) => (
              <Link
                key={k.slug}
                href={`/${k.slug}`}
                className="group rounded-2xl border border-black/5 bg-white p-4 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <div className="text-sm font-semibold text-zinc-900 group-hover:underline dark:text-zinc-50">
                  {k.keyword}
                </div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  {k.category ? `${k.category} · ` : ''}
                  {k.lastRefreshedAt ? `Updated ${new Date(k.lastRefreshedAt).toLocaleDateString()}` : 'Updating'}
                </div>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-black/5 py-10 dark:border-white/10">
        <Container>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Methodology</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            RankSheet uses aggregated Amazon keyword-level behavioral signals to compute normalized indices and trend
            deltas. We do not publish raw click/conversion share percentages. Always confirm real-time offer details on
            Amazon.
          </p>
        </Container>
      </section>
    </div>
  )
}
