'use client'

import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { useMemo } from 'react'

type PeriodItem = {
  dataPeriod: string
  updatedAt: string
  readinessLevel: string
  validCount: number
}

export function PeriodSelect(props: {
  slug: string
  periods: PeriodItem[]
  currentPeriod: string | null
  className?: string
}) {
  const router = useRouter()

  const latest = props.periods?.[0]?.dataPeriod ?? props.currentPeriod ?? null

  const value = useMemo(() => {
    if (!props.currentPeriod) return ''
    if (!latest) return props.currentPeriod
    return props.currentPeriod === latest ? '' : props.currentPeriod
  }, [latest, props.currentPeriod])

  const disabled = !latest || (props.periods?.length ?? 0) < 2

  return (
    <select
      value={value}
      disabled={disabled}
      aria-label="Select a historical period"
      className={clsx(
        'h-7 rounded-full border border-black/10 bg-white px-2 text-[11px] font-semibold text-zinc-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-black/40 dark:text-zinc-200',
        props.className,
      )}
      onChange={(e) => {
        const next = e.target.value
        if (!latest) return

        if (!next || next === latest) {
          router.push(`/${props.slug}`)
          return
        }

        router.push(`/${props.slug}?period=${encodeURIComponent(next)}`)
      }}
    >
      <option value="">{latest ? `${latest} (Current)` : 'Current'}</option>
      {(props.periods ?? [])
        .map((p) => p.dataPeriod)
        .filter((p) => p && p !== latest)
        .map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
    </select>
  )
}

