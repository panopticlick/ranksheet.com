'use client'

const hint = 'Cmd/Ctrl K'

export function CommandPaletteTrigger(props: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('ranksheet:command'))}
      className={props.className}
      aria-label="Open command palette"
    >
      <span className="hidden sm:inline">Search</span>
      <span className="ml-2 rounded border border-black/10 bg-white px-2 py-0.5 font-mono text-[11px] text-zinc-600 dark:border-white/10 dark:bg-black/40 dark:text-zinc-300">
        {hint}
      </span>
    </button>
  )
}
