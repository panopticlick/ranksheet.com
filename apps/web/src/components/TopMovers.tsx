import { clsx } from 'clsx'

import { SanitizedRowSchema } from '@ranksheet/shared'
import { z } from 'zod'

import { ProductImage } from '@/components/ProductImage'
import { TrendPill } from '@/components/TrendPill'
import type { CategoryKey } from '@/lib/ranksheet/categories'
import { buildGoToAmazonPath } from '@/lib/ranksheet/go'

type SanitizedRow = z.infer<typeof SanitizedRowSchema>

function pickTopMovers(rows: SanitizedRow[], limit: number): { risers: SanitizedRow[]; fallers: SanitizedRow[] } {
  const risers = rows
    .filter((r) => typeof r.trendDelta === 'number' && r.trendDelta > 0)
    .sort((a, b) => b.trendDelta - a.trendDelta || b.score - a.score || a.rank - b.rank)
    .slice(0, limit)

  const fallers = rows
    .filter((r) => typeof r.trendDelta === 'number' && r.trendDelta < 0)
    .sort((a, b) => a.trendDelta - b.trendDelta || b.score - a.score || a.rank - b.rank)
    .slice(0, limit)

  return { risers, fallers }
}

function Item(props: { slug: string; row: SanitizedRow; position: string; categoryKey?: CategoryKey | null }) {
  const r = props.row
  const url = buildGoToAmazonPath({ asin: r.asin, slug: props.slug, rank: r.rank, position: props.position })
  return (
    <a
      href={url}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      className={clsx(
        'group flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-3 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10',
      )}
    >
      <div className="shrink-0 text-xs font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">#{r.rank}</div>
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-white/10">
        <ProductImage src={r.image} alt={r.title} categoryKey={props.categoryKey} fill sizes="40px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-1 text-sm font-semibold text-zinc-900 group-hover:underline dark:text-zinc-50">
          {r.title}
        </div>
        <div className="mt-0.5 line-clamp-1 text-xs text-zinc-600 dark:text-zinc-300">{r.brand}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <TrendPill delta={r.trendDelta} label={r.trendLabel} />
        <span className="rounded-full bg-zinc-900 px-2 py-1 text-xs font-semibold tabular-nums text-white dark:bg-white dark:text-black">
          {r.score}
        </span>
      </div>
    </a>
  )
}

export function TopMovers(props: { slug: string; rows: SanitizedRow[]; categoryKey?: CategoryKey | null }) {
  const movers = pickTopMovers(props.rows, 3)
  const hasMovers = movers.risers.length > 0 || movers.fallers.length > 0
  if (!hasMovers) return null

  return (
    <section className="mt-6">
      <div className="rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Top movers</div>
            <div className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Biggest rank changes versus the previous period (when available). Higher score is better.
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Top risers
            </div>
            <div className="grid gap-2">
              {movers.risers.length ? (
                movers.risers.map((r) => (
                  <Item
                    key={r.asin}
                    slug={props.slug}
                    row={r}
                    position="movers_riser"
                    categoryKey={props.categoryKey}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-black/10 bg-white p-4 text-sm text-zinc-600 dark:border-white/10 dark:bg-black/20 dark:text-zinc-300">
                  No strong risers this period.
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
              Top fallers
            </div>
            <div className="grid gap-2">
              {movers.fallers.length ? (
                movers.fallers.map((r) => (
                  <Item
                    key={r.asin}
                    slug={props.slug}
                    row={r}
                    position="movers_faller"
                    categoryKey={props.categoryKey}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-black/10 bg-white p-4 text-sm text-zinc-600 dark:border-white/10 dark:bg-black/20 dark:text-zinc-300">
                  No major declines this period.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
