'use client'

import { clsx } from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'

import { PublicSheetTrendsResponseSchema } from '@ranksheet/shared'

type TrendsResponse = z.infer<typeof PublicSheetTrendsResponseSchema>
type TrendSeriesItem = TrendsResponse['series'][number]

const EMPTY_PERIODS: TrendsResponse['periods'] = []
const EMPTY_SERIES: TrendSeriesItem[] = []

const COLORS = [
  { stroke: '#0f172a', fill: '#0f172a' }, // slate-900
  { stroke: '#2563eb', fill: '#2563eb' }, // blue-600
  { stroke: '#16a34a', fill: '#16a34a' }, // green-600
  { stroke: '#9333ea', fill: '#9333ea' }, // purple-600
  { stroke: '#ea580c', fill: '#ea580c' }, // orange-600
  { stroke: '#dc2626', fill: '#dc2626' }, // red-600
  { stroke: '#0891b2', fill: '#0891b2' }, // cyan-600
  { stroke: '#a16207', fill: '#a16207' }, // amber-700
]

const MAX_LINES = 6

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function buildPath(args: {
  points: Array<{ x: number; y: number } | null>
}): string {
  let d = ''
  let started = false
  for (const p of args.points) {
    if (!p) {
      started = false
      continue
    }
    if (!started) {
      d += `M ${p.x} ${p.y} `
      started = true
      continue
    }
    d += `L ${p.x} ${p.y} `
  }
  return d.trim()
}

function defaultSelected(items: TrendSeriesItem[], max: number): string[] {
  return items.slice(0, max).map((i) => i.asin)
}

function computeMaxRank(series: TrendSeriesItem[]): number {
  const ranks: number[] = []
  for (const s of series) {
    for (const p of s.points) {
      if (typeof p.rank === 'number' && Number.isFinite(p.rank)) ranks.push(p.rank)
    }
  }
  const max = ranks.length ? Math.max(...ranks) : 20
  return clamp(max, 10, 50)
}

function ticksForMax(maxRank: number): number[] {
  const base = [1, 5, 10, 20, 50]
  const out = base.filter((t) => t <= maxRank)
  if (!out.includes(maxRank)) out.push(maxRank)
  return Array.from(new Set(out)).sort((a, b) => a - b)
}

export function RankTrajectory(props: { slug: string; asOfPeriod?: string | null }) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [data, setData] = useState<TrendsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [selected, setSelected] = useState<string[]>([])
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const url = new URL(`/api/sheet-trends`, window.location.origin)
        url.searchParams.set('slug', props.slug)
        if (props.asOfPeriod) url.searchParams.set('asOf', props.asOfPeriod)

        const res = await fetch(url, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        })
        const json = (await res.json()) as unknown
        const parsed = PublicSheetTrendsResponseSchema.safeParse(json)
        if (!parsed.success) throw new Error('invalid_trends_response')
        setData(parsed.data)
        setSelected((prev) => (prev.length ? prev : defaultSelected(parsed.data.series, Math.min(3, MAX_LINES))))
      } catch {
        setError('Trends are temporarily unavailable.')
      } finally {
        setLoading(false)
      }
    }
    void run()
    return () => controller.abort()
  }, [props.asOfPeriod, props.slug])

  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(null), 2000)
    return () => clearTimeout(t)
  }, [note])

  const safePeriods = data?.periods ?? EMPTY_PERIODS
  const safeSeries = data?.series ?? EMPTY_SERIES

  const colorByAsin = useMemo(() => {
    const out = new Map<string, (typeof COLORS)[number]>()
    for (const [idx, s] of safeSeries.entries()) {
      out.set(s.asin, COLORS[idx % COLORS.length]!)
    }
    return out
  }, [safeSeries])

  const selectedSeries = useMemo(() => {
    const set = new Set(selected)
    return safeSeries.filter((s) => set.has(s.asin)).slice(0, MAX_LINES)
  }, [safeSeries, selected])

  const maxRank = useMemo(
    () => computeMaxRank(selectedSeries.length ? selectedSeries : safeSeries),
    [safeSeries, selectedSeries],
  )
  const ticks = useMemo(() => ticksForMax(maxRank), [maxRank])

  const chart = useMemo(() => {
    const width = 920
    const height = 260
    const margin = { left: 42, right: 14, top: 18, bottom: 34 }
    const plotW = width - margin.left - margin.right
    const plotH = height - margin.top - margin.bottom

    const n = safePeriods.length
    const xs = safePeriods.map((_, idx) => {
      if (n <= 1) return margin.left
      return margin.left + (plotW * idx) / (n - 1)
    })

    const yForRank = (rank: number): number => {
      if (maxRank <= 1) return margin.top
      const t = (rank - 1) / (maxRank - 1)
      return margin.top + clamp(t, 0, 1) * plotH
    }

    const paths = selectedSeries.map((s, idx) => {
      const color = colorByAsin.get(s.asin) ?? COLORS[idx % COLORS.length]!
      const pts = s.points.map((p, i) => {
        if (p.rank == null) return null
        const x = xs[i] ?? margin.left
        const y = yForRank(p.rank)
        return { x, y }
      })
      const d = buildPath({ points: pts })
      return { asin: s.asin, d, color, points: pts }
    })

    const tickLines = ticks.map((t) => {
      const y = yForRank(t)
      return { rank: t, y }
    })

    const hoverX = typeof hoverIndex === 'number' && xs[hoverIndex] != null ? xs[hoverIndex] : null

    return { width, height, margin, xs, yForRank, paths, tickLines, hoverX }
  }, [colorByAsin, hoverIndex, maxRank, safePeriods, selectedSeries, ticks])

  const hover = useMemo(() => {
    if (!data) return null
    if (hoverIndex == null) return null
    const period = safePeriods[hoverIndex]
    if (!period) return null

    const entries = selectedSeries.map((s, idx) => {
      const p = s.points[hoverIndex]
      const rank = p?.rank ?? null
      return {
        asin: s.asin,
        title: s.title,
        rank,
        color: colorByAsin.get(s.asin) ?? COLORS[idx % COLORS.length]!,
      }
    })

    return {
      dataPeriod: period.dataPeriod,
      entries,
    }
  }, [colorByAsin, data, hoverIndex, safePeriods, selectedSeries])

  function toggle(asin: string) {
    setSelected((prev) => {
      const has = prev.includes(asin)
      if (has) return prev.filter((a) => a !== asin)
      if (prev.length >= MAX_LINES) {
        setNote(`Select up to ${MAX_LINES} lines.`)
        return prev
      }
      return [...prev, asin]
    })
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!wrapRef.current) return
    if (!safePeriods.length) return
    const rect = wrapRef.current.getBoundingClientRect()
    if (rect.width <= 0) return
    const x = e.clientX - rect.left
    const xSvg = (x / rect.width) * chart.width
    const left = chart.margin.left
    const right = chart.width - chart.margin.right
    if (xSvg < left - 8 || xSvg > right + 8) {
      setHoverIndex(null)
      return
    }
    const t = clamp((xSvg - left) / (right - left), 0, 1)
    const idx = Math.round(t * Math.max(0, safePeriods.length - 1))
    setHoverIndex(clamp(idx, 0, safePeriods.length - 1))
  }

  if (loading) {
    return (
      <section className="mt-10">
        <div className="rounded-2xl border border-black/5 bg-white p-6 dark:border-white/10 dark:bg-white/5">
          <div className="h-5 w-40 animate-pulse rounded bg-zinc-200 dark:bg-white/10" />
          <div className="mt-3 h-3 w-72 animate-pulse rounded bg-zinc-200 dark:bg-white/10" />
          <div className="mt-6 h-64 animate-pulse rounded-2xl bg-zinc-200 dark:bg-white/10" />
        </div>
      </section>
    )
  }

  if (error || !data) {
    return (
      <section className="mt-10">
        <div className="rounded-2xl border border-black/5 bg-white p-6 text-sm text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
          <div className="font-semibold text-zinc-900 dark:text-zinc-50">Rank trajectory</div>
          <div className="mt-1 leading-6">{error ?? 'Unavailable.'}</div>
        </div>
      </section>
    )
  }

  if (safePeriods.length < 2 || safeSeries.length === 0) {
    return (
      <section className="mt-10">
        <div className="rounded-2xl border border-black/5 bg-white p-6 text-sm text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
          <div className="font-semibold text-zinc-900 dark:text-zinc-50">Rank trajectory</div>
          <div className="mt-1 leading-6">Not enough history yet. Check back after a few refresh cycles.</div>
        </div>
      </section>
    )
  }

  return (
    <section className="mt-10">
      <div className="rounded-2xl border border-black/5 bg-white p-6 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Rank trajectory</div>
            <div className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Track how top products move across recent periods. Lower rank is better (1 is best).
            </div>
          </div>
          {note ? <div className="text-xs text-zinc-500 dark:text-zinc-400">{note}</div> : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {safeSeries.slice(0, 10).map((s, idx) => {
            const active = selected.includes(s.asin)
            const color = colorByAsin.get(s.asin) ?? COLORS[idx % COLORS.length]!
            return (
              <button
                key={s.asin}
                type="button"
                onClick={() => toggle(s.asin)}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium',
                  active
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200/70 dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/15',
                )}
                aria-pressed={active}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: active ? color.fill : '#a1a1aa' }} />
                <span className="max-w-[180px] truncate">{s.title}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-black/20">
          <div
            ref={wrapRef}
            className="relative"
            style={{ maxWidth: 920 }}
            onMouseMove={onMouseMove}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <svg
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              width="100%"
              height="auto"
              role="img"
              aria-label="Rank trajectory chart"
            >
              <rect x={0} y={0} width={chart.width} height={chart.height} fill="transparent" />

              {chart.tickLines.map((t) => (
                <g key={t.rank}>
                  <line
                    x1={chart.margin.left}
                    x2={chart.width - chart.margin.right}
                    y1={t.y}
                    y2={t.y}
                    stroke="currentColor"
                    strokeWidth={1}
                    className="text-black/10 dark:text-white/10"
                  />
                  <text
                    x={chart.margin.left - 10}
                    y={t.y + 4}
                    textAnchor="end"
                    fontSize={11}
                    fill="currentColor"
                    className="text-zinc-500 dark:text-zinc-400"
                  >
                    {t.rank}
                  </text>
                </g>
              ))}

              {chart.hoverX != null ? (
                <line
                  x1={chart.hoverX}
                  x2={chart.hoverX}
                  y1={chart.margin.top}
                  y2={chart.height - chart.margin.bottom}
                  stroke="currentColor"
                  strokeWidth={1}
                  className="text-zinc-900/25 dark:text-white/25"
                />
              ) : null}

              {chart.paths.map((p) => (
                <g key={p.asin}>
                  <path d={p.d} fill="none" stroke={p.color.stroke} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                  {p.points.map((pt, idx) =>
                    pt ? (
                      <circle key={`${p.asin}:${idx}`} cx={pt.x} cy={pt.y} r={3.5} fill={p.color.fill} stroke="white" strokeWidth={1.5} />
                    ) : null,
                  )}
                </g>
              ))}

              {safePeriods.map((p, idx) => {
                const x = chart.xs[idx] ?? chart.margin.left
                if (idx !== 0 && idx !== safePeriods.length - 1 && idx % 2 !== 0) return null
                return (
                  <text
                    key={p.dataPeriod}
                    x={x}
                    y={chart.height - 12}
                    textAnchor={idx === 0 ? 'start' : idx === safePeriods.length - 1 ? 'end' : 'middle'}
                    fontSize={11}
                    fill="currentColor"
                    className="text-zinc-500 dark:text-zinc-400"
                  >
                    {p.dataPeriod}
                  </text>
                )
              })}
            </svg>

            {hover ? (
              <div className="pointer-events-none absolute right-3 top-3 w-[280px] rounded-2xl border border-black/10 bg-white/95 p-3 text-xs text-zinc-700 shadow-lg backdrop-blur dark:border-white/10 dark:bg-zinc-950/90 dark:text-zinc-200">
                <div className="font-semibold text-zinc-900 dark:text-zinc-50">{hover.dataPeriod}</div>
                <div className="mt-2 grid gap-1.5">
                  {hover.entries.map((e) => (
                    <div key={e.asin} className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: e.color.fill }} />
                        <div className="truncate">{e.title}</div>
                      </div>
                      <div className="shrink-0 font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                        {typeof e.rank === 'number' ? `#${e.rank}` : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Missing points indicate the product fell outside the stored list for that period.
        </div>
      </div>
    </section>
  )
}
