import { clsx } from 'clsx'

export function Skeleton(props: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        'relative overflow-hidden rounded bg-zinc-200/80 dark:bg-white/10',
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/55 before:to-transparent dark:before:via-white/10",
        props.className,
      )}
    />
  )
}

