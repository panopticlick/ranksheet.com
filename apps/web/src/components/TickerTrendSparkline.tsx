'use client'

import { clsx } from 'clsx'
import { useEffect, useSyncExternalStore } from 'react'

import { PublicSheetMiniTrendsResponseSchema } from '@ranksheet/shared'

type SparkValue = number | null

const MAX_SLUGS_PER_BATCH = 12
const PERIODS = 8
const TOP = 3

let version = 0
const listeners = new Set<() => void>()
const valuesBySlug = new Map<string, SparkValue[]>()
const inFlight = new Set<string>()
const queue = new Set<string>()

let scheduled = false
let flushing = false

function notify() {
  version += 1
  for (const l of listeners) l()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return version
}

function ensureSlug(slug: string) {
  if (!slug) return
  if (valuesBySlug.has(slug)) return
  if (inFlight.has(slug)) return
  if (queue.has(slug)) return
  queue.add(slug)
  scheduleFlush()
}

function scheduleFlush() {
  if (scheduled) return
  scheduled = true
  setTimeout(() => {
    scheduled = false
    void flush()
  }, 0)
}

async function fetchBatch(slugs: string[]) {
  const url = new URL(`/api/sheet-trends`, window.location.origin)
  url.searchParams.set('slugs', slugs.join(','))
  url.searchParams.set('periods', String(PERIODS))
  url.searchParams.set('top', String(TOP))

  const res = await fetch(url, { headers: { accept: 'application/json' } })
  const json = (await res.json()) as unknown
  const parsed = PublicSheetMiniTrendsResponseSchema.safeParse(json)
  if (!parsed.success) return null
  return parsed.data.items
}

async function flush() {
  if (flushing) return
  if (queue.size === 0) return
  flushing = true

  try {
    while (queue.size > 0) {
      const slugs = Array.from(queue).slice(0, MAX_SLUGS_PER_BATCH)
      for (const s of slugs) {
        queue.delete(s)
        inFlight.add(s)
      }

      try {
        const items = await fetchBatch(slugs)
        if (items) {
          for (const item of items) {
            const series = item.points ?? []
            const ranks = series.map((p) => (typeof p.rank === 'number' && Number.isFinite(p.rank) ? -p.rank : null))
            valuesBySlug.set(item.slug, ranks)
          }
        } else {
          for (const s of slugs) valuesBySlug.set(s, [])
        }
      } catch {
        for (const s of slugs) valuesBySlug.set(s, [])
      } finally {
        for (const s of slugs) inFlight.delete(s)
      }

      notify()
    }
  } finally {
    flushing = false
    if (queue.size > 0) scheduleFlush()
  }
}

function buildPath(values: SparkValue[], width: number, height: number, pad: number): string {
  if (values.length < 2) return ''

  const xs = values.map((_, i) => pad + (i * (width - pad * 2)) / Math.max(1, values.length - 1))

  const clean = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (clean.length === 0) return ''
  const min = Math.min(...clean)
  const max = Math.max(...clean)
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

export function TickerTrendSparkline(props: { slug: string; fallbackDelta?: number; className?: string }) {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    ensureSlug(props.slug)
  }, [props.slug])

  const values = valuesBySlug.get(props.slug)
  const hasReal = !!values && values.length >= 2 && values.some((v) => typeof v === 'number')
  const delta = hasReal ? slope(values) : Number.isFinite(props.fallbackDelta) ? Math.trunc(props.fallbackDelta ?? 0) : 0

  const tone = hasReal
    ? delta > 0.001
      ? 'text-emerald-600 dark:text-emerald-400'
      : delta < -0.001
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-blue-600 dark:text-blue-400'
    : delta > 0
      ? 'text-emerald-400/80 dark:text-emerald-400/60'
      : delta < 0
        ? 'text-rose-400/80 dark:text-rose-400/60'
        : 'text-zinc-400/70 dark:text-zinc-500/70'

  const width = 86
  const height = 28
  const pad = 3

  if (!hasReal) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={clsx(tone, props.className)}
        aria-hidden="true"
      >
        <path d={`M ${pad} ${(height / 2).toFixed(2)} L ${(width - pad).toFixed(2)} ${(height / 2).toFixed(2)}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  const d = buildPath(values, width, height, pad)
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={clsx(tone, props.className)}
      aria-hidden="true"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

