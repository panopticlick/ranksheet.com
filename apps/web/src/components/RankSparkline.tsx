'use client'

import { clsx } from 'clsx'
import { useMemo } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts'

import { Skeleton } from '@/components/Skeleton'

export type RankSparklinePoint = {
  period: string
  rank: number | null
}

const STROKE = {
  up: '#10b981', // emerald-500
  down: '#f43f5e', // rose-500
  stable: '#94a3b8', // slate-400
} as const

function TooltipContent(props: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }) {
  if (!props.active || !props.payload?.length) return null
  const p = props.payload[0]?.payload as { period?: string; rank?: number | null } | undefined
  if (!p) return null
  return (
    <div className="rounded-md border border-black/10 bg-white/95 px-2 py-1 text-[11px] text-zinc-900 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/70 dark:text-zinc-50">
      <div className="font-mono">{p.period ?? '—'}</div>
      <div className="font-mono">
        Rank: <span className="tabular-nums">{typeof p.rank === 'number' ? p.rank : '—'}</span>
      </div>
    </div>
  )
}

export function RankSparkline(props: { points: RankSparklinePoint[]; delta: number; className?: string }) {
  const delta = Number.isFinite(props.delta) ? Math.trunc(props.delta) : 0
  const stroke = delta === 0 ? STROKE.stable : delta > 0 ? STROKE.up : STROKE.down

  const chartData = useMemo(
    () =>
      props.points.map((p, i) => ({
        i,
        period: p.period,
        rank: p.rank,
        val: typeof p.rank === 'number' && Number.isFinite(p.rank) ? -p.rank : null,
      })),
    [props.points],
  )

  if (props.points.length < 2) return <Skeleton className={clsx('h-[32px] w-[84px]', props.className)} />

  return (
    <div className={clsx('h-[32px] w-[84px]', props.className)} title="Rank trend across recent refresh periods.">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Tooltip content={TooltipContent} cursor={false} />
          <Line
            type="monotone"
            dataKey="val"
            stroke={stroke}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
