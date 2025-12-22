export function BadgeChips(props: { badges: string[] }) {
  if (!props.badges || props.badges.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {props.badges.slice(0, 4).map((b) => (
        <span
          key={b}
          className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-700 dark:bg-white/10 dark:text-zinc-200"
        >
          {b}
        </span>
      ))}
    </div>
  )
}

