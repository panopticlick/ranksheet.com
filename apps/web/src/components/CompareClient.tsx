'use client'

import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { SanitizedRowSchema } from '@ranksheet/shared'

import { BadgeChips } from '@/components/BadgeChips'
import { ProductImage } from '@/components/ProductImage'
import { ScoreBar } from '@/components/ScoreBar'
import { TrendPill } from '@/components/TrendPill'
import { buildGoToAmazonPath } from '@/lib/ranksheet/go'

type SanitizedRow = z.infer<typeof SanitizedRowSchema>

export function CompareClient(props: { slug: string; keyword: string; initialRows: SanitizedRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState<SanitizedRow[]>(props.initialRows)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(null), 1800)
    return () => clearTimeout(t)
  }, [note])

  function updateUrl(nextAsins: string[]) {
    if (nextAsins.length < 2) return
    const sp = new URLSearchParams({ slug: props.slug, asins: nextAsins.join(',') })
    router.replace(`/compare?${sp.toString()}`)
  }

  function remove(asin: string) {
    setRows((prev) => {
      const next = prev.filter((r) => r.asin !== asin)
      updateUrl(next.map((r) => r.asin))
      return next
    })
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setNote('Link copied.')
    } catch {
      setNote('Copy failed.')
    }
  }

  if (rows.length < 2) {
    return (
      <div className="mt-6 rounded-2xl border border-black/5 bg-white p-6 text-sm text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
        Select at least 2 products to compare.
      </div>
    )
  }

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-zinc-600 dark:text-zinc-300">
          Tip: compare scores and indices, then confirm final product details on Amazon.
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void copyLink()}
            className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10"
          >
            Copy link
          </button>
          {note ? <div className="text-xs text-zinc-500 dark:text-zinc-400">{note}</div> : null}
        </div>
      </div>

      <div className={clsx('mt-4 grid gap-3', rows.length <= 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3')}>
        {rows.map((r) => {
          const titleUrl = buildGoToAmazonPath({
            asin: r.asin,
            slug: props.slug,
            rank: r.rank,
            position: 'compare_title',
          })

          const ctaUrl = buildGoToAmazonPath({
            asin: r.asin,
            slug: props.slug,
            rank: r.rank,
            position: 'compare_cta',
          })

          return (
            <div
              key={r.asin}
              className="rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="relative h-14 w-14 overflow-hidden rounded-xl bg-zinc-100 dark:bg-white/10">
                    <ProductImage src={r.image} alt={r.title} fill sizes="56px" className="object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">#{r.rank}</div>
                    <a
                      href={titleUrl}
                      target="_blank"
                      rel="nofollow sponsored noopener noreferrer"
                      className="mt-1 line-clamp-2 text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {r.title}
                    </a>
                    <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{r.brand}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(r.asin)}
                  className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10"
                  aria-label={`Remove ${r.title}`}
                >
                  Remove
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2">
                  <span className="rounded-full bg-zinc-900 px-2 py-1 text-xs font-semibold tabular-nums text-white dark:bg-white dark:text-black">
                    {r.score}
                  </span>
                  <TrendPill delta={r.trendDelta} label={r.trendLabel} />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-zinc-600 dark:text-zinc-300">
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-50">Market</div>
                  <ScoreBar value={r.marketShareIndex} />
                </div>
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-50">Trust</div>
                  <ScoreBar value={r.buyerTrustIndex} />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <BadgeChips badges={r.badges} />
              </div>

              <a
                href={ctaUrl}
                target="_blank"
                rel="nofollow sponsored noopener noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100"
              >
                Check on Amazon
              </a>
            </div>
          )
        })}
      </div>

      <div className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
        Showing {rows.length} items.
      </div>
    </section>
  )
}
