'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { z } from 'zod'

import { PublicKeywordRequestsListResponseSchema } from '@ranksheet/shared'

import { CATEGORIES, type CategoryKey, getCategoryLabel } from '@/lib/ranksheet/categories'

const CreateResponseSchema = z.object({
  ok: z.literal(true),
  requestId: z.number().int().min(1),
  slug: z.string().optional(),
  voted: z.boolean().optional(),
  votes: z.number().int().min(0).optional(),
})

const VoteResponseSchema = z.object({
  ok: z.literal(true),
  requestId: z.number().int().min(1),
  voted: z.boolean(),
  votes: z.number().int().min(0),
})

type RequestItem = z.infer<typeof PublicKeywordRequestsListResponseSchema>['items'][number]

export function KeywordRequestsClient(props: { initialKeyword: string; initialItems: RequestItem[]; initialTotal: number }) {
  const [keyword, setKeyword] = useState(props.initialKeyword)
  const [category, setCategory] = useState<CategoryKey | ''>('')
  const [email, setEmail] = useState('')
  const [noteText, setNoteText] = useState('')

  const [items, setItems] = useState<RequestItem[]>(props.initialItems)
  const [total, setTotal] = useState<number>(props.initialTotal)

  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [votedIds, setVotedIds] = useState<Set<number>>(() => new Set())

  const canSubmit = useMemo(() => keyword.trim().length >= 2 && !busy, [busy, keyword])

  async function refresh() {
    const res = await fetch('/api/keyword-requests?limit=50&offset=0', { headers: { accept: 'application/json' } })
    const json = (await res.json()) as unknown
    const parsed = PublicKeywordRequestsListResponseSchema.safeParse(json)
    if (!parsed.success) throw new Error('invalid_keyword_requests_response')
    setItems(parsed.data.items)
    setTotal(parsed.data.total)
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/keyword-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          ...(category ? { category } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(noteText.trim() ? { note: noteText.trim() } : {}),
        }),
      })

      const json = (await res.json()) as unknown
      const parsed = CreateResponseSchema.safeParse(json)
      if (!parsed.success) throw new Error('invalid_create_response')

      if (parsed.data.voted) setVotedIds((prev) => new Set(prev).add(parsed.data.requestId))
      setMessage(parsed.data.voted ? 'Request submitted and upvoted.' : 'Request submitted.')

      await refresh()
      setNoteText('')
    } catch {
      setMessage('Request failed. Please try again later.')
    } finally {
      setBusy(false)
    }
  }

  async function vote(id: number) {
    if (busy) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/keyword-requests/${id}/vote`, {
        method: 'POST',
        headers: { accept: 'application/json' },
      })
      const json = (await res.json()) as unknown
      const parsed = VoteResponseSchema.safeParse(json)
      if (!parsed.success) throw new Error('invalid_vote_response')

      if (parsed.data.voted) {
        setVotedIds((prev) => new Set(prev).add(id))
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, votes: parsed.data.votes } : it)))
        setMessage('Upvoted.')
      } else {
        setVotedIds((prev) => new Set(prev).add(id))
        setMessage('You already voted for this request.')
      }
    } catch {
      setMessage('Vote failed. Please try again later.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 2500)
    return () => clearTimeout(t)
  }, [message])

  return (
    <section className="mt-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Submit a request</div>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            We’ll use these requests to prioritize new RankSheets. Email is optional (for updates only).
          </p>

          <form className="mt-4 grid gap-3" onSubmit={(e) => void submitRequest(e)}>
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Keyword</label>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder='e.g. "wireless earbuds for running"'
                className="mt-1 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-white/15 dark:bg-black/40 dark:text-zinc-50 dark:placeholder:text-zinc-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Category (optional)</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CategoryKey | '')}
                  className="mt-1 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-zinc-900 outline-none dark:border-white/15 dark:bg-black/40 dark:text-zinc-50"
                >
                  <option value="">Any</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Email (optional)</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-white/15 dark:bg-black/40 dark:text-zinc-50 dark:placeholder:text-zinc-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Note (optional)</label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="What would you like to learn from this ranking?"
                rows={3}
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-white/15 dark:bg-black/40 dark:text-zinc-50 dark:placeholder:text-zinc-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className={clsx(
                  'inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold',
                  !canSubmit
                    ? 'cursor-not-allowed bg-zinc-300 text-zinc-600 dark:bg-white/10 dark:text-zinc-400'
                    : 'bg-zinc-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100',
                )}
              >
                Submit
              </button>
              {message ? <div className="text-xs text-zinc-500 dark:text-zinc-400">{message}</div> : null}
            </div>

            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              By submitting, you agree to our{' '}
              <Link href="/privacy" className="underline hover:text-zinc-900 dark:hover:text-zinc-50">
                privacy policy
              </Link>
              .
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Top requests</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {items.length} shown • {total} total
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {items.length ? (
              items.map((it) => {
                const voted = votedIds.has(it.id)
                return (
                  <div
                    key={it.id}
                    className="rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-black/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{it.keyword}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                          <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
                            {getCategoryLabel(it.category ?? null)}
                          </span>
                          <Link
                            href={`/search?q=${encodeURIComponent(it.keyword)}`}
                            className="text-zinc-500 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                          >
                            Check availability
                          </Link>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <div className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                          {it.votes} votes
                        </div>
                        <button
                          type="button"
                          onClick={() => void vote(it.id)}
                          disabled={busy || voted}
                          className={clsx(
                            'rounded-full px-3 py-1.5 text-sm font-semibold',
                            busy || voted
                              ? 'cursor-not-allowed bg-zinc-300 text-zinc-600 dark:bg-white/10 dark:text-zinc-400'
                              : 'bg-zinc-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100',
                          )}
                        >
                          {voted ? 'Voted' : 'Upvote'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white p-6 text-sm text-zinc-600 dark:border-white/10 dark:bg-black/20 dark:text-zinc-300">
                No requests yet. Be the first to submit one.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
