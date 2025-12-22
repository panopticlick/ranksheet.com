'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { PublicSheetMiniTrendsResponseSchema } from '@ranksheet/shared'

import { Container } from '@/components/Container'
import { RelativeTime } from '@/components/RelativeTime'

function isoDate(input: string | null | undefined): string {
  if (!input) return '—'
  const d = new Date(input)
  if (!Number.isFinite(d.valueOf())) return '—'
  return d.toISOString().slice(0, 10)
}

function hashString(input: string): number {
  let h = 5381
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 33) ^ input.charCodeAt(i)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type SparkValue = number | null

function buildPath(values: SparkValue[], width: number, height: number, pad: number): string {
  const xs = values.map((_, i) => pad + (i * (width - pad * 2)) / Math.max(1, values.length - 1))

  const clean = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  const min = clean.length ? Math.min(...clean) : 0
  const max = clean.length ? Math.max(...clean) : 1
  const span = max - min
  const constant = Math.abs(span) < 1e-6
  const safeSpan = constant ? 1 : Math.max(1e-9, span)

  let d = ''
  let started = false
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      started = false
      continue
    }

    const t = constant ? 0.5 : (v - min) / safeSpan
    const x = xs[i] ?? pad
    const y = pad + (1 - t) * (height - pad * 2)

    if (!started) {
      d += `M ${x.toFixed(2)} ${y.toFixed(2)} `
      started = true
    } else {
      d += `L ${x.toFixed(2)} ${y.toFixed(2)} `
    }
  }

  return d.trim()
}

function slope(values: SparkValue[]): number {
  const clean = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (clean.length < 2) return 0
  return clean[clean.length - 1]! - clean[0]!
}

function MiniSparkline(props: { seed: string; values?: SparkValue[] }) {
  const width = 72
  const height = 24
  const pad = 3

  const fallback = useMemo(() => {
    const rand = mulberry32(hashString(props.seed))
    return Array.from({ length: 10 }, () => rand())
  }, [props.seed])

  const hasReal = !!props.values && props.values.length >= 2 && props.values.some((v) => typeof v === 'number')
  const values = hasReal ? props.values! : fallback
  const d = buildPath(values, width, height, pad)
  const delta = hasReal ? slope(values) : 0
  const tone = !hasReal
    ? 'text-zinc-400/70 dark:text-zinc-500/70'
    : delta > 0.001
      ? 'text-emerald-600 dark:text-emerald-400'
      : delta < -0.001
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-blue-600 dark:text-blue-400'

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={tone} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type RelatedItem = {
  slug: string
  keyword: string
  topN?: number
  lastRefreshedAt?: string | null
}

export function RelatedSheets(props: { items: RelatedItem[]; categoryLabel?: string; categoryKey?: string | null }) {
  const items = props.items
  const displayedItems = useMemo(() => items.slice(0, 9), [items])
  const slugs = useMemo(() => Array.from(new Set(displayedItems.map((i) => i.slug))), [displayedItems])
  const [valuesBySlug, setValuesBySlug] = useState<Record<string, SparkValue[]>>({})

  useEffect(() => {
    if (slugs.length === 0) return
    const missing = slugs.filter((s) => !valuesBySlug[s])
    if (missing.length === 0) return
    const controller = new AbortController()

    const run = async () => {
      try {
        const url = new URL(`/api/sheet-trends`, window.location.origin)
        url.searchParams.set('slugs', missing.join(','))
        url.searchParams.set('periods', '8')
        url.searchParams.set('top', '3')

        const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } })
        const json = (await res.json()) as unknown
        const parsed = PublicSheetMiniTrendsResponseSchema.safeParse(json)
        if (!parsed.success) return

        const next: Record<string, SparkValue[]> = {}
        for (const item of parsed.data.items) {
          const series = item.points ?? []
          const ranks = series.map((p) => (typeof p.rank === 'number' && Number.isFinite(p.rank) ? -p.rank : null))
          const hasAny = ranks.some((v) => typeof v === 'number')
          if (!hasAny) continue
          next[item.slug] = ranks
        }

        if (Object.keys(next).length > 0) setValuesBySlug((prev) => ({ ...prev, ...next }))
      } catch {
        // Optional UI; ignore failures and keep showing deterministic fallback lines.
      }
    }

    void run()
    return () => controller.abort()
  }, [slugs, valuesBySlug])

  if (displayedItems.length === 0) return null

  const title = props.categoryLabel ? `More Analysis in ${props.categoryLabel}` : 'More Market Tickers'
  return (
    <section className="border-t border-black/5 py-10 dark:border-white/10">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h2>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Jump across adjacent tickers in the same topic cluster.</div>
          </div>
          {props.categoryKey ? (
            <Link
              href={`/category/${encodeURIComponent(props.categoryKey)}`}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
            >
              View category →
            </Link>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {displayedItems.map((k) => {
            const updated = isoDate(k.lastRefreshedAt ?? null)
            return (
              <Link
                key={k.slug}
                href={`/${k.slug}`}
                className="group rounded-2xl border border-black/5 bg-white p-4 hover:bg-blue-50/30 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="line-clamp-1 text-sm font-semibold text-zinc-900 group-hover:underline dark:text-zinc-50">
                      Best {k.keyword}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span>
                        Updated{' '}
                        <RelativeTime
                          iso={k.lastRefreshedAt ?? null}
                          fallback={updated}
                          title={updated !== '—' ? updated : undefined}
                        />
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                      <span className="tabular-nums">{k.topN ?? 20} Products</span>
                    </div>
                  </div>

                  <div
                    className="shrink-0 text-blue-600 opacity-70 transition-opacity group-hover:opacity-100 dark:text-blue-400"
                    title="Leader trajectory (sampled from recent periods)"
                  >
                    <MiniSparkline seed={k.slug} values={valuesBySlug[k.slug]} />
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span className="truncate">/{k.slug}</span>
                  <span className="shrink-0 font-sans text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    Open →
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </Container>
    </section>
  )
}
