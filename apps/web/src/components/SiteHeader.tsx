import Link from 'next/link'

import { CommandPaletteTrigger } from '@/components/CommandPaletteTrigger'
import { Container } from '@/components/Container'
import { SearchBox } from '@/components/SearchBox'
import { CATEGORIES } from '@/lib/ranksheet/categories'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-black/60">
      <Container className="flex h-14 items-center gap-4">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold text-white dark:bg-white dark:text-black">
            R
          </span>
          <span>RankSheet</span>
        </Link>

        <div className="flex flex-1 items-center gap-4">
          <SearchBox className="hidden max-w-xl flex-1 md:block" />

          <nav className="hidden items-center gap-5 text-sm text-zinc-600 dark:text-zinc-300 lg:flex">
            {CATEGORIES.slice(0, 6).map((c) => (
              <Link key={c.key} href={`/category/${c.key}`} className="hover:text-zinc-900 dark:hover:text-zinc-50">
                {c.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <CommandPaletteTrigger className="hidden rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10 md:inline-flex" />
          <Link
            href="/requests"
            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10"
          >
            Request
          </Link>
          <Link
            href="/search"
            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10 md:hidden"
          >
            Search
          </Link>
          <Link
            href="/#explore"
            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10"
          >
            Explore
          </Link>
        </div>
      </Container>
    </header>
  )
}
