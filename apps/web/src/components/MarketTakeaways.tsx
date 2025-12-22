import Link from 'next/link'

import { SanitizedRowSchema } from '@ranksheet/shared'
import { z } from 'zod'

import { buildGoToAmazonPath } from '@/lib/ranksheet/go'

type SanitizedRow = z.infer<typeof SanitizedRowSchema>

function clampIndex(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0
}

function bestBy(rows: SanitizedRow[], key: 'buyerTrustIndex' | 'marketShareIndex' | 'score'): SanitizedRow | null {
  let best: SanitizedRow | null = null
  let bestValue = -Infinity
  for (const r of rows) {
    const raw = r[key] as unknown
    const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : -Infinity
    if (value > bestValue) {
      bestValue = value
      best = r
    }
  }
  return best
}

function topMover(rows: SanitizedRow[]): SanitizedRow | null {
  return (
    rows
      .filter((r) => typeof r.trendDelta === 'number' && r.trendDelta > 0)
      .sort((a, b) => b.trendDelta - a.trendDelta || b.score - a.score || a.rank - b.rank)[0] ?? null
  )
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`
}

export function MarketTakeaways(props: { slug: string; keyword: string; rows: SanitizedRow[] }) {
  const rows = props.rows ?? []
  const top = rows[0] ?? null
  if (!top) return null

  const second = rows[1] ?? null
  const leaderGap = second ? clampIndex(top.marketShareIndex) - clampIndex(second.marketShareIndex) : null

  const top10 = rows.slice(0, 10)
  const rising = top10.filter((r) => (r.trendDelta ?? 0) > 0).length
  const falling = top10.filter((r) => (r.trendDelta ?? 0) < 0).length

  const trustPick = bestBy(top10, 'buyerTrustIndex')
  const scorePick = bestBy(top10, 'score')
  const mover = topMover(top10)

  const topUrl = buildGoToAmazonPath({ asin: top.asin, slug: props.slug, rank: top.rank, position: 'takeaways_leader' })
  const trustUrl = trustPick
    ? buildGoToAmazonPath({ asin: trustPick.asin, slug: props.slug, rank: trustPick.rank, position: 'takeaways_trust' })
    : null
  const moverUrl = mover
    ? buildGoToAmazonPath({ asin: mover.asin, slug: props.slug, rank: mover.rank, position: 'takeaways_mover' })
    : null

  const compareAsins = trustPick && trustPick.asin !== top.asin ? `${top.asin},${trustPick.asin}` : null

  return (
    <section className="mt-6" id="takeaways">
      <div className="rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Key takeaways</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              A quick, human-readable summary for <span className="font-medium text-zinc-900 dark:text-zinc-50">“{props.keyword}”</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="#table"
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-200 dark:hover:bg-white/10"
            >
              Jump to table →
            </Link>
            {compareAsins ? (
              <Link
                href={`/compare?${new URLSearchParams({ slug: props.slug, asins: compareAsins }).toString()}`}
                className="rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-semibold text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100"
              >
                Compare picks →
              </Link>
            ) : null}
          </div>
        </div>

        <ul className="mt-4 grid gap-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
          <li>
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">Market leader:</span>{' '}
            <a href={topUrl} target="_blank" rel="nofollow sponsored noopener noreferrer" className="font-semibold hover:underline">
              {top.title}
            </a>{' '}
            leads with <span className="font-mono tabular-nums">Score {top.score}</span> and{' '}
            <span className="font-mono tabular-nums">Market IDX {clampIndex(top.marketShareIndex)}</span>.
            {leaderGap != null ? (
              <>
                {' '}
                The gap versus #2 is <span className="font-mono tabular-nums">{leaderGap >= 0 ? '+' : ''}{leaderGap} IDX</span>.
              </>
            ) : null}
          </li>

          {trustPick && trustUrl ? (
            <li>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">Trust pick:</span>{' '}
              <a href={trustUrl} target="_blank" rel="nofollow sponsored noopener noreferrer" className="font-semibold hover:underline">
                {trustPick.title}
              </a>{' '}
              has the highest <span className="font-mono tabular-nums">Trust IDX {clampIndex(trustPick.buyerTrustIndex)}</span> in the current Top 10.
            </li>
          ) : null}

          {mover && moverUrl ? (
            <li>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">Top mover:</span>{' '}
              <a href={moverUrl} target="_blank" rel="nofollow sponsored noopener noreferrer" className="font-semibold hover:underline">
                {mover.title}
              </a>{' '}
              climbed <span className="font-mono tabular-nums">▲{mover.trendDelta}</span> {plural(mover.trendDelta, 'position')} versus the previous period.
            </li>
          ) : null}

          <li>
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">Momentum snapshot:</span> In the current Top 10,{' '}
            <span className="font-mono tabular-nums">{plural(rising, 'product')}</span> are rising and{' '}
            <span className="font-mono tabular-nums">{plural(falling, 'product')}</span> are falling.
            {scorePick ? (
              <>
                {' '}
                Highest overall score in Top 10: <span className="font-semibold">{scorePick.title}</span> (<span className="font-mono tabular-nums">Score {scorePick.score}</span>).
              </>
            ) : null}
          </li>
        </ul>
      </div>
    </section>
  )
}

