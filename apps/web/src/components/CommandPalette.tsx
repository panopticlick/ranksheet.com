'use client'

import { usePathname, useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { Command } from 'cmdk'
import { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'

import { PublicSearchIndexResponseSchema } from '@ranksheet/shared'

type SearchIndexItem = z.infer<typeof PublicSearchIndexResponseSchema>['items'][number]

const INDEX_STORAGE_KEY = 'ranksheet.searchIndex.v1'
const INDEX_TS_KEY = 'ranksheet.searchIndex.ts'
const RECENTS_KEY = 'ranksheet.recents.v1'
const INDEX_TTL_MS = 24 * 60 * 60 * 1000

function safeJsonParse<T>(input: string | null): T | null {
  if (!input) return null
  try {
    return JSON.parse(input) as T
  } catch {
    return null
  }
}

function readRecentSlugs(): string[] {
  const raw = safeJsonParse<unknown>(localStorage.getItem(RECENTS_KEY))
  if (!Array.isArray(raw)) return []
  return raw
    .map((v) => (typeof v === 'string' ? v : ''))
    .filter(Boolean)
    .slice(0, 3)
}

function writeRecentSlugs(slugs: string[]) {
  localStorage.setItem(RECENTS_KEY, JSON.stringify(slugs.slice(0, 3)))
}

function normalizeQuery(input: string): string {
  return input.trim().toLowerCase()
}

function rankMatch(item: SearchIndexItem, q: string): number {
  const title = item.title.toLowerCase()
  const slug = item.slug.toLowerCase()
  if (title === q) return 0
  if (title.startsWith(q)) return 1
  if (slug.startsWith(q)) return 2
  if (title.includes(q)) return 3
  if (slug.includes(q)) return 4
  return 999
}

export function CommandPalette() {
  const router = useRouter()
  const pathname = usePathname()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [index, setIndex] = useState<SearchIndexItem[]>([])
  const [recents, setRecents] = useState<string[]>([])

  useEffect(() => {
    setRecents(readRecentSlugs())
  }, [])

  useEffect(() => {
    if (!pathname) return
    const match = pathname.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)$/)
    if (!match) return
    const slug = match[1]
    if (!slug) return

    setRecents((prev) => {
      const next = [slug, ...prev.filter((s) => s !== slug)].slice(0, 3)
      writeRecentSlugs(next)
      return next
    })
  }, [pathname])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
        return
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        setOpen(false)
      }
    }

    const onOpen = () => setOpen(true)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('ranksheet:command', onOpen)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('ranksheet:command', onOpen)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  async function loadIndex(args: { force?: boolean } = {}) {
    if (status === 'loading') return
    if (!args.force && status === 'ready' && index.length) return

    const cachedAt = safeJsonParse<number>(localStorage.getItem(INDEX_TS_KEY))
    const cachedItems = safeJsonParse<unknown>(localStorage.getItem(INDEX_STORAGE_KEY))
    const canUseCache =
      typeof cachedAt === 'number' &&
      Number.isFinite(cachedAt) &&
      Date.now() - cachedAt < INDEX_TTL_MS &&
      Array.isArray(cachedItems)

    if (canUseCache) {
      const parsed = PublicSearchIndexResponseSchema.safeParse({ ok: true, items: cachedItems })
      if (parsed.success) {
        setIndex(parsed.data.items)
        setStatus('ready')
        return
      }
    }

    setStatus('loading')
    try {
      const res = await fetch('/api/search-index?limit=5000', { headers: { accept: 'application/json' } })
      const json = (await res.json()) as unknown
      const parsed = PublicSearchIndexResponseSchema.safeParse(json)
      if (!parsed.success) throw new Error('invalid_search_index')

      setIndex(parsed.data.items)
      setStatus('ready')
      localStorage.setItem(INDEX_STORAGE_KEY, JSON.stringify(parsed.data.items))
      localStorage.setItem(INDEX_TS_KEY, JSON.stringify(Date.now()))
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    if (!open) return
    void loadIndex()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const q = useMemo(() => normalizeQuery(query), [query])

  const results = useMemo(() => {
    if (q.length < 2) return []
    if (index.length === 0) return []

    const scored = index
      .map((it) => ({ it, score: rankMatch(it, q) }))
      .filter((x) => x.score < 999)
      .sort((a, b) => a.score - b.score || a.it.title.length - b.it.title.length || a.it.title.localeCompare(b.it.title))
      .slice(0, 12)
      .map((x) => x.it)

    return scored
  }, [index, q])

  const recentItems = useMemo(() => {
    if (recents.length === 0) return []
    const bySlug = new Map(index.map((it) => [it.slug, it] as const))
    return recents.map((slug) => bySlug.get(slug) ?? { slug, title: slug.replace(/-/g, ' ') }).slice(0, 3)
  }, [index, recents])

  function goToSlug(slug: string) {
    setOpen(false)
    setQuery('')
    router.push(`/${slug}`)
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Market search"
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
      onMouseDown={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      <div className="relative w-full max-w-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <Command
          shouldFilter={false}
          className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-950"
        >
          <div className="border-b border-black/5 p-3 dark:border-white/10">
            <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 dark:border-white/10 dark:bg-black/40">
              <span className="font-mono text-xs font-semibold text-zinc-500 dark:text-zinc-400">⌘K</span>
              <Command.Input
                ref={inputRef}
                value={query}
                onValueChange={setQuery}
                placeholder="Search markets… (e.g., earbuds, air fryer)"
                className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50 dark:placeholder:text-zinc-500"
              />
              <button
                type="button"
                onClick={() => void loadIndex({ force: true })}
                className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-black dark:text-zinc-200 dark:hover:bg-white/10"
                title="Refresh index"
              >
                Sync
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="font-mono">Type to jump • Enter to open • Esc to close</span>
              <span className="font-mono">
                {status === 'loading' ? 'Loading…' : status === 'error' ? 'Index unavailable' : `${index.length} tickers`}
              </span>
            </div>
          </div>

          <Command.List className="max-h-[380px] overflow-auto p-2">
            {q.length < 2 ? (
              <>
                {recentItems.length ? (
                  <Command.Group
                    heading="Recent"
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-zinc-500 dark:[&_[cmdk-group-heading]]:text-zinc-400 [&_[cmdk-group-items]]:grid [&_[cmdk-group-items]]:gap-1"
                  >
                    {recentItems.map((it) => (
                      <Command.Item
                        key={it.slug}
                        value={it.slug}
                        onSelect={() => goToSlug(it.slug)}
                        className={clsx(
                          'flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-zinc-900 aria-selected:bg-blue-50/60 dark:text-zinc-50 dark:aria-selected:bg-white/10',
                        )}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{it.title}</div>
                          <div className="truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">/{it.slug}</div>
                        </div>
                        <div className="shrink-0 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">↵</div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : (
                  <div className="px-3 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    Press <span className="font-mono font-semibold">⌘K</span> anytime and type a market name.
                  </div>
                )}

                <div className="mt-2 border-t border-black/5 pt-2 dark:border-white/10">
                  <Command.Item
                    value="__search_page__"
                    onSelect={() => {
                      setOpen(false)
                      setQuery('')
                      router.push('/search')
                    }}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-zinc-900 aria-selected:bg-blue-50/60 dark:text-zinc-50 dark:aria-selected:bg-white/10"
                  >
                    <span className="font-semibold">Open search</span>
                    <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">/search</span>
                  </Command.Item>
                  <Command.Item
                    value="__requests__"
                    onSelect={() => {
                      setOpen(false)
                      setQuery('')
                      router.push('/requests')
                    }}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-zinc-900 aria-selected:bg-blue-50/60 dark:text-zinc-50 dark:aria-selected:bg-white/10"
                  >
                    <span className="font-semibold">Request a ticker</span>
                    <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">/requests</span>
                  </Command.Item>
                </div>
              </>
            ) : results.length ? (
              <Command.Group
                heading="Markets"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-zinc-500 dark:[&_[cmdk-group-heading]]:text-zinc-400 [&_[cmdk-group-items]]:grid [&_[cmdk-group-items]]:gap-1"
              >
                {results.map((it) => (
                  <Command.Item
                    key={it.slug}
                    value={it.slug}
                    onSelect={() => goToSlug(it.slug)}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-zinc-900 aria-selected:bg-blue-50/60 dark:text-zinc-50 dark:aria-selected:bg-white/10"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{it.title}</div>
                      <div className="truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">/{it.slug}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      Open
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : (
              <div className="px-3 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No matches for <span className="font-mono font-semibold">{query.trim()}</span>.
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      setQuery('')
                      router.push(`/requests?keyword=${encodeURIComponent(query.trim())}`)
                    }}
                    className="inline-flex items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-black shadow-sm hover:bg-amber-500"
                  >
                    Request “{query.trim()}” ➔
                  </button>
                </div>
              </div>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
