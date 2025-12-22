import Link from 'next/link'

import { SanitizedRowSchema } from '@ranksheet/shared'
import { z } from 'zod'

type SanitizedRow = z.infer<typeof SanitizedRowSchema>

function clampIndex(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0
}

function topBrands(rows: SanitizedRow[], limit: number): Array<{ brand: string; count: number }> {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const brand = (r.brand ?? '').trim()
    if (!brand) continue
    counts.set(brand, (counts.get(brand) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([brand, count]) => ({ brand, count }))
    .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand))
    .slice(0, limit)
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

export function MarketBrief(props: { keyword: string; dataPeriod?: string | null; rows: SanitizedRow[] }) {
  const rows = props.rows ?? []
  if (rows.length < 2) return null

  const top = rows[0]!
  const second = rows[1]!

  const top20 = rows.slice(0, 20)
  const top10 = rows.slice(0, 10)

  const leaderGap = clampIndex(top.marketShareIndex) - clampIndex(second.marketShareIndex)
  const trustLeader = bestBy(top20, 'buyerTrustIndex')
  const scoreLeader = bestBy(top20, 'score')

  const rising = top10.filter((r) => (r.trendDelta ?? 0) > 0).length
  const falling = top10.filter((r) => (r.trendDelta ?? 0) < 0).length
  const stable = Math.max(0, top10.length - rising - falling)

  const brands = topBrands(top20, 4)
  const uniqueBrands = new Set(top20.map((r) => (r.brand ?? '').trim()).filter(Boolean)).size
  const topBrand = brands[0] ?? null

  return (
    <div className="mt-6 rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Market brief</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Quick signals for <span className="font-medium text-zinc-900 dark:text-zinc-50">“{props.keyword}”</span>. All values are normalized indices (0–100), not raw shares.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {props.dataPeriod ? (
            <span className="rounded-full bg-zinc-100 px-3 py-1 font-mono text-[11px] font-semibold text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
              Period {props.dataPeriod}
            </span>
          ) : null}
          <Link
            href="#methodology"
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-200 dark:hover:bg-white/10"
          >
            How we rank →
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-black/30">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Leader gap</div>
          <div className="mt-2 font-mono text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {leaderGap >= 0 ? '+' : ''}
            {leaderGap} IDX
          </div>
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Market Share IDX difference (#1 vs #2)</div>
        </div>

        <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-black/30">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Trust leader</div>
          <div className="mt-2 line-clamp-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {trustLeader?.title ?? '—'}
          </div>
          <div className="mt-1 font-mono text-xs tabular-nums text-blue-700 dark:text-blue-300">
            IDX {trustLeader ? clampIndex(trustLeader.buyerTrustIndex) : '—'}
          </div>
        </div>

        <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-black/30">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Momentum</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs tabular-nums">
            <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              ▲ {rising}
            </span>
            <span className="rounded-full bg-zinc-200/70 px-2 py-1 font-semibold text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
              — {stable}
            </span>
            <span className="rounded-full bg-rose-50 px-2 py-1 font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              ▼ {falling}
            </span>
          </div>
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Top 10 movement count</div>
        </div>

        <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-black/30">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Brand mix</div>
          <div className="mt-2 font-mono text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {uniqueBrands} brands
          </div>
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            {topBrand ? `Top brand appears ${topBrand.count}× in Top 20` : 'Brand coverage in Top 20'}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Top brands</div>
        {brands.length ? (
          brands.map((b) => (
            <span
              key={b.brand}
              className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-zinc-800 shadow-sm ring-1 ring-black/5 dark:bg-black/20 dark:text-zinc-100 dark:ring-white/10"
              title={`${b.brand} appears ${b.count}× in Top 20`}
            >
              <span className="truncate">{b.brand}</span>
              <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">{b.count}×</span>
            </span>
          ))
        ) : (
          <span className="text-xs text-zinc-600 dark:text-zinc-300">—</span>
        )}

        {scoreLeader ? (
          <div className="ml-auto text-xs text-zinc-500 dark:text-zinc-400" title="Highest RankSheet Score in Top 20.">
            Top score: <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{clampIndex(scoreLeader.score)}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
