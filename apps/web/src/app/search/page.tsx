import Link from 'next/link'
import type { Metadata } from 'next'

import { Container } from '@/components/Container'
import { SearchBox } from '@/components/SearchBox'
import { searchPublicKeywords } from '@/lib/cms/public'
import { CATEGORIES, getCategoryLabel } from '@/lib/ranksheet/categories'

export const revalidate = 0

export async function generateMetadata(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const searchParams = await props.searchParams
  const qRaw = searchParams.q
  const q = Array.isArray(qRaw) ? qRaw[0] : qRaw
  const title = q ? `Search “${q}”` : 'Search'
  return {
    title,
    robots: { index: false, follow: false },
  }
}

export default async function SearchPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams
  const qRaw = searchParams.q
  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw)?.trim() ?? ''

  const results =
    q.length >= 2 ? await searchPublicKeywords({ q, limit: 30 }, { revalidateSeconds: 60 }).catch(() => null) : null

  return (
    <main className="py-10">
      <Container>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Search</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          Find a RankSheet by keyword. We only index high-quality, ready sheets.
        </p>

        <div className="mt-5 max-w-2xl">
          <SearchBox />
        </div>

        {q.length >= 2 ? (
          <div className="mt-8">
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              Results for <span className="font-semibold text-zinc-900 dark:text-zinc-50">“{q}”</span>
            </div>

            <div className="mt-4 grid gap-3">
              {results?.items?.length ? (
                results.items.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/${r.slug}`}
                    className="rounded-2xl border border-black/5 bg-white p-4 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{r.keyword}</div>
                        <div className="mt-1 truncate text-xs text-zinc-500">/{r.slug}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
                          {getCategoryLabel(r.category ?? null)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-black/5 bg-white p-4 text-sm text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-50">No results found</div>
                  <div className="mt-1 leading-6">Try a broader keyword (e.g. “earbuds”, “air fryer”).</div>
                  <div className="mt-3">
                    <Link
                      href={`/requests?keyword=${encodeURIComponent(q)}`}
                      className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100"
                    >
                      Request “{q}”
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-10">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Browse categories</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CATEGORIES.filter((c) => c.key !== 'other').map((c) => (
                <Link
                  key={c.key}
                  href={`/category/${c.key}`}
                  className="rounded-2xl border border-black/5 bg-white p-4 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <div className="font-semibold text-zinc-900 dark:text-zinc-50">{c.label}</div>
                  <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{c.description}</div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </Container>
    </main>
  )
}
