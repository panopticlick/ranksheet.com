import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { z } from 'zod'

import { CompareClient } from '@/components/CompareClient'
import { Container } from '@/components/Container'
import { getPublicSheetBySlug } from '@/lib/cms/public'

export const revalidate = 3600

const SearchSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  asins: z.string().min(1).max(5000),
})

function normalizeAsin(input: string): string | null {
  const asin = input.trim().toUpperCase()
  if (!/^[A-Z0-9]{10}$/.test(asin)) return null
  return asin
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Compare',
    robots: { index: false, follow: false },
  }
}

export default async function ComparePage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams
  const slugRaw = searchParams.slug
  const asinsRaw = searchParams.asins

  const slug = Array.isArray(slugRaw) ? slugRaw[0] : slugRaw
  const asins = Array.isArray(asinsRaw) ? asinsRaw[0] : asinsRaw

  const parsed = SearchSchema.safeParse({ slug: slug ?? '', asins: asins ?? '' })
  if (!parsed.success) {
    return (
      <main className="py-10">
        <Container>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Compare</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            Select 2–5 products from a RankSheet to compare.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100"
            >
              Back to home
            </Link>
          </div>
        </Container>
      </main>
    )
  }

  const MAX_COMPARE = 5
  const asinsList = parsed.data.asins
    .split(',')
    .map((s) => normalizeAsin(s))
    .filter((v): v is string => !!v)

  const deduped: string[] = []
  for (const a of asinsList) {
    if (!deduped.includes(a)) deduped.push(a)
    if (deduped.length >= MAX_COMPARE) break
  }

  if (deduped.length < 2) {
    return (
      <main className="py-10">
        <Container>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Compare</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            Select at least 2 products to compare.
          </p>
          <div className="mt-6">
            <Link
              href={`/${encodeURIComponent(parsed.data.slug)}`}
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100"
            >
              Back to sheet
            </Link>
          </div>
        </Container>
      </main>
    )
  }

  const data = await getPublicSheetBySlug(parsed.data.slug, {}, { revalidateSeconds: 3600 }).catch(() => null)
  if (!data) notFound()

  if (!data.sheet) {
    return (
      <main className="py-10">
        <Container>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Compare</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            This sheet is warming up. Please check back soon.
          </p>
          <div className="mt-6">
            <Link
              href={`/${encodeURIComponent(parsed.data.slug)}`}
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100"
            >
              Back to sheet
            </Link>
          </div>
        </Container>
      </main>
    )
  }

  const rowByAsin = new Map(data.sheet.rows.map((r) => [r.asin, r] as const))
  const selectedRows = deduped.map((a) => rowByAsin.get(a)).filter((r): r is NonNullable<typeof r> => !!r)

  if (selectedRows.length < 2) {
    return (
      <main className="py-10">
        <Container>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Compare</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            Some selected products are no longer available in the latest Top list. Please re-select from the sheet.
          </p>
          <div className="mt-6">
            <Link
              href={`/${encodeURIComponent(parsed.data.slug)}`}
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100"
            >
              Back to sheet
            </Link>
          </div>
        </Container>
      </main>
    )
  }

  return (
    <main className="py-10">
      <Container>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Compare</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {data.keyword.keyword}
            </h1>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Comparing {selectedRows.length} products from this RankSheet.
            </div>
          </div>

          <Link
            href={`/${encodeURIComponent(parsed.data.slug)}`}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/10"
          >
            Back to sheet
          </Link>
        </div>

        <CompareClient slug={parsed.data.slug} keyword={data.keyword.keyword} initialRows={selectedRows} />
      </Container>
    </main>
  )
}
