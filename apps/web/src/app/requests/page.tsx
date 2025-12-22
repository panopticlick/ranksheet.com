import type { Metadata } from 'next'
import Link from 'next/link'

import { Container } from '@/components/Container'
import { KeywordRequestsClient } from '@/components/KeywordRequestsClient'
import { getPublicKeywordRequests } from '@/lib/cms/public'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Request a keyword',
    robots: { index: false, follow: false },
  }
}

export default async function RequestsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams
  const keywordRaw = searchParams.keyword ?? searchParams.q
  const initialKeyword = (Array.isArray(keywordRaw) ? keywordRaw[0] : keywordRaw)?.trim() ?? ''

  const list = await getPublicKeywordRequests({ limit: 50, offset: 0 }, { revalidateSeconds: 60 }).catch(() => null)

  return (
    <main className="py-10">
      <Container>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Request a keyword</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Don’t see your keyword yet? Submit a request and vote on others. We’ll prioritize the most‑requested
              sheets.
            </p>
          </div>

          <Link
            href="/search"
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10"
          >
            Search sheets
          </Link>
        </div>

        <KeywordRequestsClient
          initialKeyword={initialKeyword}
          initialItems={list?.items ?? []}
          initialTotal={list?.total ?? 0}
        />
      </Container>
    </main>
  )
}
