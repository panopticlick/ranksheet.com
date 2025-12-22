import type { Metadata } from 'next'
import Link from 'next/link'

import { Container } from '@/components/Container'

export const metadata: Metadata = {
  title: 'Not found',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div className="py-20">
      <Container>
        <div className="rounded-2xl border border-black/5 bg-white p-8 dark:border-white/10 dark:bg-white/5">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Page not found</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            This sheet doesn’t exist (or it’s not indexable yet). Try browsing categories instead.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100"
            >
              Go home
            </Link>
            <Link
              href="/#explore"
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10"
            >
              Explore categories
            </Link>
            <Link
              href="/requests"
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10"
            >
              Request a ticker
            </Link>
          </div>
        </div>
      </Container>
    </div>
  )
}
