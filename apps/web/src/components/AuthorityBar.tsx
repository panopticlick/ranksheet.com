import { clsx } from 'clsx'

function clampIndex(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0
}

function labelForIndex(score: number): 'High' | 'Med' | 'Low' {
  if (score >= 75) return 'High'
  if (score >= 45) return 'Med'
  return 'Low'
}

export function AuthorityBar(props: { score: number; className?: string; title?: string }) {
  const score = clampIndex(props.score)
  const label = labelForIndex(score)
  return (
    <div
      className={clsx('flex w-[110px] flex-col gap-1', props.className)}
      title={props.title ?? 'Relative click volume (index).'}
    >
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
        <div className="h-full rounded-full bg-blue-600 dark:bg-blue-500" style={{ width: `${score}%` }} />
      </div>
      <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
        <span>{label}</span>
        <span className="tabular-nums">IDX {score}</span>
      </div>
    </div>
  )
}

