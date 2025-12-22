'use client'

import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { useEffect, useMemo, useState } from 'react'

import { PublicSheetTrendsResponseSchema, SanitizedRowSchema, SheetModeSchema } from '@ranksheet/shared'
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'

import { AuthorityBar } from '@/components/AuthorityBar'
import { ProductImage } from '@/components/ProductImage'
import { RankSparkline, type RankSparklinePoint } from '@/components/RankSparkline'
import { ScoreBar } from '@/components/ScoreBar'
import { TrendPill } from '@/components/TrendPill'
import { buildGoToAmazonPath } from '@/lib/ranksheet/go'

type SanitizedRow = z.infer<typeof SanitizedRowSchema>
type SheetMode = z.infer<typeof SheetModeSchema>

type SortKey = 'rank' | 'score' | 'market' | 'trust' | 'trend'
type TrendFilter = 'all' | 'Rising' | 'Falling' | 'Stable'

const BADGE_OPTIONS = ['👑 Category King', '📈 Trending', '🧲 High Intent', '🎨 Multiple Options'] as const
const MIN_SCORE_OPTIONS = [null, 60, 70, 80, 90] as const
const MAX_COMPARE = 5

function RankChip(props: { rank: number }) {
  const r = Math.trunc(props.rank)
  const base = 'inline-flex h-8 w-8 items-center justify-center rounded-full font-mono text-sm font-semibold tabular-nums'
  if (r === 1) return <span className={clsx(base, 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200')}>1</span>
  if (r === 2) return <span className={clsx(base, 'bg-zinc-100 text-zinc-900 dark:bg-white/10 dark:text-zinc-100')}>2</span>
  if (r === 3) return <span className={clsx(base, 'bg-orange-100 text-orange-900 dark:bg-orange-500/15 dark:text-orange-200')}>3</span>
  return <span className="font-mono text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{r}</span>
}

function BadgeRow(props: { badges: string[] }) {
  const items = (props.badges ?? []).slice(0, 4)
  if (items.length === 0) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {items.map((b) => (
        <span
          key={b}
          className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:bg-white/10 dark:text-zinc-200"
        >
          {b}
        </span>
      ))}
    </div>
  )
}

function clampIndex(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0
}

function levelForIndex(value: number): 'High' | 'Med' | 'Low' {
  if (value >= 75) return 'High'
  if (value >= 45) return 'Med'
  return 'Low'
}

function blocksForIndex(value: number): string {
  const v = clampIndex(value)
  const filled = Math.max(0, Math.min(5, Math.round(v / 20)))
  return `${'█'.repeat(filled)}${'░'.repeat(5 - filled)}`
}

function csvEscape(value: string): string {
  const v = value ?? ''
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

function toCsv(rows: SanitizedRow[]): string {
  const header = [
    'Rank',
    'ASIN',
    'Title',
    'Brand',
    'Score',
    'MarketShareIndex',
    'BuyerTrustIndex',
    'TrendDelta',
    'TrendLabel',
    'Badges',
  ]
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push(
      [
        String(r.rank),
        csvEscape(r.asin),
        csvEscape(r.title),
        csvEscape(r.brand),
        String(r.score),
        String(r.marketShareIndex),
        String(r.buyerTrustIndex),
        String(r.trendDelta),
        csvEscape(r.trendLabel),
        csvEscape(r.badges.join(' | ')),
      ].join(','),
    )
  }
  return `${lines.join('\n')}\n`
}

function toTsv(rows: SanitizedRow[]): string {
  const header = [
    'Rank',
    'ASIN',
    'Title',
    'Brand',
    'Score',
    'MarketShareIndex',
    'BuyerTrustIndex',
    'TrendDelta',
    'TrendLabel',
    'Badges',
  ]
  const lines = [header.join('\t')]
  for (const r of rows) {
    lines.push(
      [
        String(r.rank),
        r.asin,
        r.title.replace(/\t/g, ' '),
        r.brand.replace(/\t/g, ' '),
        String(r.score),
        String(r.marketShareIndex),
        String(r.buyerTrustIndex),
        String(r.trendDelta),
        r.trendLabel,
        r.badges.join(' | ').replace(/\t/g, ' '),
      ].join('\t'),
    )
  }
  return `${lines.join('\n')}\n`
}

export function RankSheetClient(props: {
  slug: string
  keyword: string
  mode: SheetMode
  rows: SanitizedRow[]
  asOfPeriod?: string | null
}) {
  const router = useRouter()
  const [showAll, setShowAll] = useState(false)
  const [stickyVisible, setStickyVisible] = useState(false)

  const [productQuery, setProductQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [trendFilter, setTrendFilter] = useState<TrendFilter>('all')
  const [minScore, setMinScore] = useState<number | null>(null)
  const [badgeFilters, setBadgeFilters] = useState<string[]>([])
  const [selectedAsins, setSelectedAsins] = useState<string[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [sparklineByAsin, setSparklineByAsin] = useState<Record<string, RankSparklinePoint[]>>({})

  const selectedSet = useMemo(() => new Set(selectedAsins), [selectedAsins])

  const filteredSorted = useMemo(() => {
    const q = productQuery.trim().toLowerCase()

    const filtered = props.rows.filter((r) => {
      if (q) {
        const hay = `${r.title} ${r.brand} ${r.asin}`.toLowerCase()
        if (!hay.includes(q)) return false
      }

      if (trendFilter !== 'all' && r.trendLabel !== trendFilter) return false
      if (typeof minScore === 'number' && r.score < minScore) return false

      if (badgeFilters.length > 0) {
        const hasAny = badgeFilters.some((b) => r.badges.includes(b))
        if (!hasAny) return false
      }

      return true
    })

    const sorted = [...filtered]
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'rank':
          return a.rank - b.rank
        case 'score':
          return b.score - a.score || a.rank - b.rank
        case 'market':
          return b.marketShareIndex - a.marketShareIndex || a.rank - b.rank
        case 'trust':
          return b.buyerTrustIndex - a.buyerTrustIndex || a.rank - b.rank
        case 'trend':
          return b.trendDelta - a.trendDelta || a.rank - b.rank
        default:
          return a.rank - b.rank
      }
    })

    return sorted
  }, [badgeFilters, minScore, productQuery, props.rows, sortKey, trendFilter])

  const displayed = useMemo(() => {
    const max = showAll ? 20 : 10
    return filteredSorted.slice(0, max)
  }, [filteredSorted, showAll])

  const top = props.rows[0] ?? null
  const topUrl = top
    ? buildGoToAmazonPath({ asin: top.asin, slug: props.slug, rank: top.rank, position: 'sticky_cta' })
    : null

  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setStickyVisible(window.scrollY > 280))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const run = async () => {
      try {
        const url = new URL(`/api/sheet-trends`, window.location.origin)
        url.searchParams.set('slug', props.slug)
        url.searchParams.set('top', '20')
        url.searchParams.set('periods', '12')
        if (props.asOfPeriod) url.searchParams.set('asOf', props.asOfPeriod)
        const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } })
        const json = (await res.json()) as unknown
        const parsed = PublicSheetTrendsResponseSchema.safeParse(json)
        if (!parsed.success) return

        const next: Record<string, RankSparklinePoint[]> = {}
        for (const s of parsed.data.series) {
          next[s.asin] = s.points.map((p) => ({ period: p.dataPeriod, rank: p.rank ?? null }))
        }
        setSparklineByAsin(next)
      } catch {
        // Optional UI; ignore failures and keep showing skeleton sparklines.
      }
    }
    void run()
    return () => controller.abort()
  }, [props.asOfPeriod, props.slug])

  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(null), 1800)
    return () => clearTimeout(t)
  }, [note])

  const lowData = props.mode === 'LOW_DATA'

  const hasActiveFilters =
    productQuery.trim() !== '' ||
    trendFilter !== 'all' ||
    typeof minScore === 'number' ||
    badgeFilters.length > 0

  function clearFilters() {
    setProductQuery('')
    setTrendFilter('all')
    setMinScore(null)
    setBadgeFilters([])
    setSortKey('rank')
    setShowAll(false)
  }

  function toggleBadgeFilter(badge: string) {
    setBadgeFilters((prev) => (prev.includes(badge) ? prev.filter((b) => b !== badge) : [...prev, badge]))
  }

  function toggleSelected(asin: string) {
    setSelectedAsins((prev) => {
      const exists = prev.includes(asin)
      if (exists) return prev.filter((a) => a !== asin)
      if (prev.length >= MAX_COMPARE) {
        setNote(`You can compare up to ${MAX_COMPARE} products.`)
        return prev
      }
      return [...prev, asin]
    })
  }

  function clearSelected() {
    setSelectedAsins([])
  }

  function startCompare() {
    const ordered = props.rows
      .filter((r) => selectedSet.has(r.asin))
      .map((r) => r.asin)
      .slice(0, MAX_COMPARE)

    if (ordered.length < 2) {
      setNote('Select at least 2 products to compare.')
      return
    }

    const sp = new URLSearchParams({ slug: props.slug, asins: ordered.join(',') })
    router.push(`/compare?${sp.toString()}`)
  }

  function downloadCsv() {
    const csv = toCsv(filteredSorted)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `${props.slug}-ranksheet.csv`
    a.click()

    setTimeout(() => URL.revokeObjectURL(url), 800)
    setNote('Exported CSV.')
  }

  async function copyToSheets() {
    const tsv = toTsv(filteredSorted)
    try {
      await navigator.clipboard.writeText(tsv)
      setNote('Copied to clipboard.')
    } catch {
      setNote('Copy failed.')
    }
  }

  const columns: Array<ColumnDef<SanitizedRow>> = [
    {
      id: 'compare',
      header: 'Cmp',
      cell: ({ row }) => {
        const r = row.original
        return (
          <input
            type="checkbox"
            checked={selectedSet.has(r.asin)}
            onChange={() => toggleSelected(r.asin)}
            className="h-4 w-4 rounded border-black/20 text-zinc-900 focus:ring-2 focus:ring-zinc-300 dark:border-white/20 dark:bg-black/40 dark:focus:ring-white/20"
            aria-label={`Select ${r.title} for compare`}
          />
        )
      },
    },
    {
      accessorKey: 'rank',
      header: 'Rank',
      cell: ({ row }) => <RankChip rank={row.original.rank} />,
    },
    {
      id: 'product',
      header: 'Product',
      cell: ({ row }) => {
        const r = row.original
        const titleUrl = buildGoToAmazonPath({
          asin: r.asin,
          slug: props.slug,
          rank: r.rank,
          position: 'table_title',
        })
        return (
          <div className="flex items-start gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-black/10 bg-zinc-100 dark:border-white/10 dark:bg-white/10">
              <ProductImage
                src={r.image}
                alt={r.title}
                fill
                sizes="48px"
                className="object-cover transition-transform duration-200 group-hover:scale-110"
              />
            </div>
            <div className="min-w-0">
              <a
                href={titleUrl}
                target="_blank"
                rel="nofollow sponsored noopener noreferrer"
                className="line-clamp-2 text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
              >
                {r.title}
              </a>
              <div className="mt-0.5 line-clamp-1 text-xs text-zinc-600 dark:text-zinc-300">{r.brand}</div>
              <BadgeRow badges={r.badges} />
            </div>
          </div>
        )
      },
    },
    {
      id: 'trend',
      header: 'Trend',
      cell: ({ row }) => {
        const r = row.original
        const points = sparklineByAsin[r.asin] ?? []
        return (
          <div className="flex items-center gap-2">
            <RankSparkline points={points} delta={r.trendDelta} />
            <TrendPill delta={r.trendDelta} label={r.trendLabel} />
          </div>
        )
      },
    },
    {
      id: 'authority',
      header: 'Authority',
      cell: ({ row }) => (
        <AuthorityBar score={row.original.marketShareIndex} title="Relative click volume (index). Based on aggregated shopper behavior." />
      ),
    },
    {
      id: 'trust',
      header: 'Trust',
      cell: ({ row }) => <ScoreBar value={row.original.buyerTrustIndex} />,
    },
    {
      accessorKey: 'score',
      header: 'Score',
      cell: ({ row }) => (
        <span className="inline-flex items-center rounded-full bg-zinc-900 px-2 py-1 font-mono text-xs font-semibold tabular-nums text-white dark:bg-white dark:text-black">
          {row.original.score}
        </span>
      ),
    },
    {
      id: 'action',
      header: 'Action',
      cell: ({ row }) => {
        const r = row.original
        const ctaUrl = buildGoToAmazonPath({
          asin: r.asin,
          slug: props.slug,
          rank: r.rank,
          position: 'table_cta',
        })
        return (
          <a
            href={ctaUrl}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full bg-amber-400 px-3 py-1.5 text-xs font-bold text-black shadow-sm transition-transform duration-150 hover:bg-amber-500 group-hover:scale-[1.03]"
          >
            Check Price ➔
          </a>
        )
      },
    },
  ]

  const table = useReactTable({
    data: displayed,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="mt-8" id="table">
      {lowData ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
          <div className="font-semibold">Low Data Mode</div>
          <div className="mt-1 leading-6">
            This sheet is based on limited data for this specific query. Use it as a starting point and confirm final
            details on Amazon.
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder="Filter products…"
              className="h-10 w-full rounded-full border border-black/10 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-white/15 dark:bg-black/40 dark:text-zinc-50 dark:placeholder:text-zinc-500"
              aria-label="Filter products"
            />

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Sort</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="h-10 rounded-full border border-black/10 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none dark:border-white/15 dark:bg-black/40 dark:text-zinc-50"
                aria-label="Sort"
              >
                <option value="rank">Rank</option>
                <option value="score">Score</option>
                <option value="market">Market</option>
                <option value="trust">Trust</option>
                <option value="trend">Trend</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadCsv}
              className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => void copyToSheets()}
              className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10"
            >
              Copy for Sheets
            </button>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <div className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 dark:bg-white/10">
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">Trend</span>
            {(['all', 'Rising', 'Stable', 'Falling'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTrendFilter(t)}
                className={clsx(
                  'rounded-full px-2 py-0.5',
                  trendFilter === t
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                    : 'text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10',
                )}
              >
                {t === 'all' ? 'All' : t}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 dark:bg-white/10">
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">Min score</span>
            <select
              value={minScore ?? ''}
              onChange={(e) => setMinScore(e.target.value ? Number(e.target.value) : null)}
              className="h-7 rounded-full border border-black/10 bg-white px-2 text-xs text-zinc-900 outline-none dark:border-white/15 dark:bg-black/40 dark:text-zinc-50"
              aria-label="Minimum score"
            >
              {MIN_SCORE_OPTIONS.map((v) => (
                <option key={String(v)} value={v ?? ''}>
                  {v == null ? 'Any' : `${v}+`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {BADGE_OPTIONS.map((b) => {
              const active = badgeFilters.includes(b)
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => toggleBadgeFilter(b)}
                  className={clsx(
                    'rounded-full px-3 py-1 text-xs font-medium',
                    active
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200/70 dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/15',
                  )}
                >
                  {b}
                </button>
              )
            })}
          </div>

          <div className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
            Showing <span className="font-semibold text-zinc-900 dark:text-zinc-50">{displayed.length}</span> of{' '}
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">{filteredSorted.length}</span>
          </div>
        </div>

        {selectedAsins.length > 0 ? (
          <div className="mt-3 rounded-2xl border border-black/5 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-black/30 dark:text-zinc-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                Selected <span className="font-semibold">{selectedAsins.length}</span> for compare (max {MAX_COMPARE}).
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={startCompare}
                  disabled={selectedAsins.length < 2}
                  className={clsx(
                    'rounded-full px-3 py-1.5 text-sm font-semibold',
                    selectedAsins.length < 2
                      ? 'cursor-not-allowed bg-zinc-300 text-zinc-600 dark:bg-white/10 dark:text-zinc-400'
                      : 'bg-zinc-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100',
                  )}
                >
                  Compare
                </button>
                <button
                  type="button"
                  onClick={clearSelected}
                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {note ? <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{note}</div> : null}
      </div>

      {filteredSorted.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white p-6 text-sm text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
          <div className="font-semibold text-zinc-900 dark:text-zinc-50">No matches</div>
          <div className="mt-1 leading-6">No products match your current filters. Try clearing filters or broadening your search.</div>
        </div>
      ) : null}

      <div className="mt-4 hidden overflow-hidden rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-white/5 md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-zinc-50 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:bg-white/5 dark:text-zinc-300">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => {
                    const id = header.column.id
                    return (
                      <th
                        key={header.id}
                        className={clsx(
                          'px-3 py-2',
                          id === 'compare' && 'w-14 text-center',
                          id === 'rank' && 'w-20',
                          id === 'product' && 'min-w-[360px]',
                          id === 'trend' && 'w-52',
                          id === 'authority' && 'w-36',
                          id === 'trust' && 'w-32',
                          id === 'score' && 'w-28',
                          id === 'action' && 'w-36 text-right',
                        )}
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="group hover:bg-blue-50/30 dark:hover:bg-white/5">
                  {row.getVisibleCells().map((cell) => {
                    const id = cell.column.id
                    return (
                      <td
                        key={cell.id}
                        className={clsx(
                          'px-3 py-3 align-top',
                          id === 'compare' && 'text-center',
                          id === 'action' && 'text-right',
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredSorted.length > 10 ? (
          <div className="flex items-center justify-between border-t border-black/5 bg-white px-4 py-3 text-sm text-zinc-600 dark:border-white/10 dark:bg-transparent dark:text-zinc-300">
            <div>
              Showing <span className="font-semibold">{displayed.length}</span> of{' '}
              <span className="font-semibold">{filteredSorted.length}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="rounded-full border border-black/10 bg-white px-3 py-1.5 font-medium text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10"
            >
              {showAll ? 'Show 10' : 'Show 20'}
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:hidden">
        {displayed.map((r) => {
          const titleUrl = buildGoToAmazonPath({
            asin: r.asin,
            slug: props.slug,
            rank: r.rank,
            position: 'card_title',
          })

          const ctaUrl = buildGoToAmazonPath({
            asin: r.asin,
            slug: props.slug,
            rank: r.rank,
            position: 'card_cta',
          })

          const badge =
            r.badges.includes('👑 Category King') || r.rank === 1
              ? '👑 Category King'
              : r.badges.includes('📈 Trending')
                ? '📈 Trending'
                : (r.badges[0] ?? null)

          const authLevel = levelForIndex(r.marketShareIndex)
          const authBlocks = blocksForIndex(r.marketShareIndex)

          const delta = Number.isFinite(r.trendDelta) ? Math.trunc(r.trendDelta) : 0
          const deltaText = delta > 0 ? `▲${delta}` : delta < 0 ? `▼${Math.abs(delta)}` : '—'
          const deltaClass =
            delta > 0
              ? 'text-emerald-700 dark:text-emerald-300'
              : delta < 0
                ? 'text-rose-700 dark:text-rose-300'
                : 'text-zinc-600 dark:text-zinc-300'

          return (
            <div key={r.asin} className="rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="font-mono text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                    #{r.rank}
                  </div>
                  {badge ? (
                    <span className="rounded bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      {badge}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(r.asin)}
                      onChange={() => toggleSelected(r.asin)}
                      className="h-4 w-4 rounded border-black/20 text-zinc-900 focus:ring-2 focus:ring-zinc-300 dark:border-white/20 dark:bg-black/40 dark:focus:ring-white/20"
                      aria-label={`Select ${r.title} for compare`}
                    />
                    <span className="sr-only">Compare</span>
                  </label>
                  <span className="rounded-full bg-zinc-900 px-2 py-1 font-mono text-xs font-semibold tabular-nums text-white dark:bg-white dark:text-black">
                    {r.score}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-start gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-black/10 bg-zinc-100 dark:border-white/10 dark:bg-white/10">
                  <ProductImage src={r.image} alt={r.title} fill sizes="80px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <a
                    href={titleUrl}
                    target="_blank"
                    rel="nofollow sponsored noopener noreferrer"
                    className="line-clamp-2 text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
                  >
                    {r.title}
                  </a>
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{r.brand}</div>
                  <BadgeRow badges={r.badges} />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-zinc-600 dark:text-zinc-300">
                <span title="Rank movement vs previous period.">
                  Trend:{' '}
                  <span className={clsx('tabular-nums', deltaClass)}>
                    {deltaText} {r.trendLabel}
                  </span>
                </span>
                <span title="Relative click volume (index).">
                  Auth: <span className="tabular-nums">{authBlocks}</span> ({authLevel})
                </span>
                <span title="Normalized buyer trust index.">Trust: {clampIndex(r.buyerTrustIndex)}</span>
              </div>

              <a
                href={ctaUrl}
                target="_blank"
                rel="nofollow sponsored noopener noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-black shadow-sm hover:bg-amber-500"
              >
                Check Price on Amazon ➔
              </a>
            </div>
          )
        })}

        {filteredSorted.length > 10 ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10"
          >
            {showAll ? 'Show 10' : 'Show 20'}
          </button>
        ) : null}
      </div>

      {top && topUrl ? (
        <div
          className={clsx(
            'fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/90 p-3 backdrop-blur dark:border-white/10 dark:bg-black/70 md:hidden',
            stickyVisible ? 'translate-y-0' : 'translate-y-full',
            'transition-transform duration-200',
          )}
        >
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-1">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Top pick</div>
              <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">#1 {top.title}</div>
            </div>
            <a
              href={topUrl}
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
              className="shrink-0 rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-black shadow-sm hover:bg-amber-500"
            >
              Go ➔
            </a>
          </div>
        </div>
      ) : null}
    </section>
  )
}
