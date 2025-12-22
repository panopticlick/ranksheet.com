'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'

const SearchResponseSchema = z.object({
  ok: z.literal(true),
  q: z.string(),
  items: z.array(
    z.object({
      slug: z.string(),
      keyword: z.string(),
      category: z.string().nullable().optional(),
    }),
  ),
})

type Suggestion = z.infer<typeof SearchResponseSchema>['items'][number]

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [delayMs, value])
  return debounced
}

export function SearchBox(props: { className?: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query, 150)

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Suggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)

  const trimmed = useMemo(() => query.trim(), [query])
  const canSearch = trimmed.length >= 2

  useEffect(() => {
    if (!canSearch) {
      setItems([])
      setOpen(false)
      setActiveIndex(-1)
      return
    }

    const controller = new AbortController()
    const run = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(debounced)}`, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        })
        const json = (await res.json()) as unknown
        const parsed = SearchResponseSchema.safeParse(json)
        if (!parsed.success) return
        setItems(parsed.data.items.slice(0, 12))
        setOpen(true)
        setActiveIndex(-1)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }

    void run()
    return () => controller.abort()
  }, [canSearch, debounced])

  function goToSearch() {
    const q = trimmed
    if (!q) return
    setOpen(false)
    router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
      return
    }
    if (!open) {
      if (e.key === 'Enter') goToSearch()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(items.length, i + 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(-1, i - 1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const selected = activeIndex >= 0 ? items[activeIndex] : null
      if (selected) {
        setOpen(false)
        router.push(`/${selected.slug}`)
        return
      }
      goToSearch()
    }
  }

  const actionItem = useMemo(() => ({ slug: '', keyword: '', category: null }), [])
  const extended = open ? [...items, actionItem] : []

  return (
    <div className={props.className}>
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => canSearch && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder="Search rank sheets…"
          className="h-10 w-full rounded-full border border-black/10 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-white/15 dark:bg-black/40 dark:text-zinc-50 dark:placeholder:text-zinc-500"
          aria-label="Search"
        />

        {loading ? (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
            Loading…
          </div>
        ) : null}

        {open ? (
          <div className="absolute left-0 right-0 top-11 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-lg dark:border-white/15 dark:bg-zinc-950">
            <div className="max-h-80 overflow-auto py-2 text-sm">
              {extended.length === 0 ? (
                <div className="px-4 py-3 text-zinc-500">
                  <div>No matches.</div>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setOpen(false)
                      router.push(`/requests?keyword=${encodeURIComponent(trimmed)}`)
                    }}
                    className="mt-2 inline-flex items-center justify-center rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100"
                  >
                    Request “{trimmed}”
                  </button>
                </div>
              ) : (
                extended.map((s, idx) => {
                  const isAction = idx === extended.length - 1
                  const isActive = idx === activeIndex
                  if (isAction) {
                    return (
                      <button
                        key="__search_all__"
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => goToSearch()}
                        className={[
                          'flex w-full items-center justify-between px-4 py-2.5 text-left',
                          isActive ? 'bg-zinc-50 dark:bg-white/10' : '',
                        ].join(' ')}
                      >
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">Search for “{trimmed}”</span>
                        <span className="text-xs text-zinc-500">Enter</span>
                      </button>
                    )
                  }

                  return (
                    <Link
                      key={s.slug}
                      href={`/${s.slug}`}
                      onMouseDown={(e) => e.preventDefault()}
                      className={[
                        'block px-4 py-2.5',
                        isActive ? 'bg-zinc-50 dark:bg-white/10' : 'hover:bg-zinc-50 dark:hover:bg-white/10',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-zinc-900 dark:text-zinc-50">{s.keyword}</div>
                          <div className="truncate text-xs text-zinc-500">{s.slug}</div>
                        </div>
                        {s.category ? (
                          <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
                            {s.category}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
