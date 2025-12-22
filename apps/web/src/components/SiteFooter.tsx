import Link from 'next/link'

import { Container } from '@/components/Container'

export function SiteFooter() {
  return (
    <footer className="border-t border-black/5 py-10 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-300">
      <Container className="flex flex-col gap-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xl space-y-1">
            <div className="font-semibold text-zinc-900 dark:text-zinc-50">RankSheet</div>
            <p>
              Data-driven product rankings based on aggregated Amazon US search-term behavior. We never display raw
              percentage shares—only normalized indices and trends.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/#methodology" className="hover:text-zinc-900 dark:hover:text-zinc-50">
              Methodology
            </Link>
            <Link href="/#explore" className="hover:text-zinc-900 dark:hover:text-zinc-50">
              Categories
            </Link>
            <Link href="/affiliate-disclosure" className="hover:text-zinc-900 dark:hover:text-zinc-50">
              Affiliate Disclosure
            </Link>
            <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-50">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-50">
              Terms
            </Link>
            <a
              href="https://www.amazon.com/"
              rel="nofollow noopener noreferrer"
              target="_blank"
              className="hover:text-zinc-900 dark:hover:text-zinc-50"
            >
              Amazon
            </a>
          </div>
        </div>

        <div className="border-t border-black/5 pt-6 text-xs dark:border-white/10">
          <p>
            As an Amazon Associate, we earn from qualifying purchases. RankSheet is not affiliated with Amazon.com,
            Inc. or its affiliates.
          </p>
        </div>
      </Container>
    </footer>
  )
}

