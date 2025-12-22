import { clsx } from 'clsx'

export function ScoreBar(props: { value: number; label?: string; className?: string }) {
  const value = Number.isFinite(props.value) ? Math.max(0, Math.min(100, Math.round(props.value))) : 0

  return (
    <div className={clsx('flex items-center gap-2', props.className)}>
      <div className="h-2 w-24 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/15">
        <div className="h-full rounded-full bg-zinc-900 dark:bg-white" style={{ width: `${value}%` }} />
      </div>
      <div className="tabular-nums text-xs text-zinc-700 dark:text-zinc-300">
        {props.label ?? `${value}`}
      </div>
    </div>
  )
}

