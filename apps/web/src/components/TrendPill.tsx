import { clsx } from 'clsx'

export function TrendPill(props: { delta: number; label: string }) {
  const delta = Number.isFinite(props.delta) ? Math.trunc(props.delta) : 0
  const isUp = delta > 0
  const isDown = delta < 0

  const text = isUp ? `▲ ${delta}` : isDown ? `▼ ${Math.abs(delta)}` : '—'

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium tabular-nums',
        isUp && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
        isDown && 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
        !isUp && !isDown && 'bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300',
      )}
      title={props.label}
    >
      {text}
    </span>
  )
}

