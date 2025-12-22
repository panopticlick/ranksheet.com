'use client'

import { useState } from 'react'
import { Container } from '@/components/Container'

export type FAQItem = { q: string; a: string; id?: string }

export function FAQ(props: { items: FAQItem[]; maxItems?: number; showExpandAll?: boolean }) {
  const { items, maxItems = 6, showExpandAll = false } = props
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())
  const [expandAll, setExpandAll] = useState(false)

  if (!items || items.length === 0) return null

  const displayItems = items.slice(0, maxItems)

  const toggleItem = (index: number) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedItems(newExpanded)
  }

  const toggleExpandAll = () => {
    if (expandAll) {
      setExpandedItems(new Set())
    } else {
      setExpandedItems(new Set(displayItems.map((_, i) => i)))
    }
    setExpandAll(!expandAll)
  }

  return (
    <section className="border-t border-black/5 py-10 dark:border-white/10">
      <Container>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">FAQ</h2>
          {showExpandAll && displayItems.length > 1 && (
            <button
              onClick={toggleExpandAll}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              {expandAll ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>
        <div className="mt-4 space-y-2">
          {displayItems.map((item, index) => {
            const isOpen = expandedItems.has(index)
            const itemId = item.id ?? `faq-${index}`

            return (
              <details
                key={itemId}
                open={isOpen}
                className="group rounded-2xl border border-black/5 bg-white p-4 open:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:open:bg-white/10"
              >
                <summary
                  onClick={(e) => {
                    e.preventDefault()
                    toggleItem(index)
                  }}
                  className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  <span className="select-none">{item.q}</span>
                  <span
                    className="flex-shrink-0 text-zinc-400 transition-transform group-open:rotate-180 dark:text-zinc-500"
                    aria-hidden="true"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M4 6L8 10L12 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </summary>
                <div className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{item.a}</div>
              </details>
            )
          })}
        </div>
      </Container>
    </section>
  )
}

