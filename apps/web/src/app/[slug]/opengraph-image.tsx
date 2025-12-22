import { z } from 'zod'

import { PublicSheetsResponseSchema } from '@ranksheet/shared'

import { env } from '@/lib/env'
import { fetchJson } from '@/lib/http/fetchJson'
import { makeOgImage } from '@/lib/og/ogImage'
import { makeTickerOgImage } from '@/lib/og/tickerOgImage'
import { getCategoryLabel } from '@/lib/ranksheet/categories'

export const runtime = 'edge'

const ParamsSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
})

function isoDate(input: string | null | undefined): string | null {
  if (!input) return null
  return input.length >= 10 ? input.slice(0, 10) : null
}

export default async function Image(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params
  // Optional: when generating OG for historical snapshots, the caller may include `?period=YYYY-MM`.
  const searchParams = (props as { searchParams?: Promise<Record<string, string | string[] | undefined>> }).searchParams
  const resolvedSearch = searchParams ? await searchParams : null
  const rawPeriod = resolvedSearch ? (Array.isArray(resolvedSearch.period) ? resolvedSearch.period[0] : resolvedSearch.period) : null
  const requestedPeriod = typeof rawPeriod === 'string' && /^\d{4}-\d{2}(?:-\d{2})?$/.test(rawPeriod) ? rawPeriod : null

  const parsed = ParamsSchema.safeParse({ slug: params.slug })
  const slug = parsed.success ? parsed.data.slug : 'ranksheet'

  const upstreamUrl = new URL(`${env.CMS_PUBLIC_URL}/api/public/sheets/${encodeURIComponent(slug)}`)
  if (requestedPeriod) upstreamUrl.searchParams.set('period', requestedPeriod)

  const json = await fetchJson<unknown>(upstreamUrl.toString(), { timeoutMs: 4000 }).catch(() => null)
  const sheetParsed = PublicSheetsResponseSchema.safeParse(json)

  if (!sheetParsed.success) {
    return makeOgImage({
      title: slug.replace(/-/g, ' '),
      subtitle: 'Data‑driven Amazon rankings — no raw percentage shares.',
      kicker: 'RankSheet',
      footerLeft: 'ranksheet.com',
      footerRight: 'Updated weekly',
    })
  }

  const data = sheetParsed.data
  const keyword = data.keyword.keyword
  const categoryLabel = getCategoryLabel(data.keyword.category ?? undefined)
  const dataPeriod = data.sheet?.dataPeriod ?? null
  const updated = isoDate(data.sheet?.updatedAt ?? null)

  const top = data.sheet?.rows?.[0] ?? null

  if (!top) {
    const title = data.sheet ? keyword : `${keyword} (Updating…)`
    return makeOgImage({
      title,
      subtitle: `Top products ranked for “${keyword}” using normalized indices derived from aggregated Amazon US shopper behavior.`,
      kicker: categoryLabel,
      footerLeft: dataPeriod ? `Period: ${dataPeriod}` : 'RankSheet.com',
      footerRight: updated ? `Updated: ${updated}` : '',
    })
  }

  return makeTickerOgImage({
    slug,
    keyword,
    categoryLabel,
    dataPeriod: dataPeriod,
    updatedAt: updated,
    leaderTitle: top.title,
    leaderImage: top.image,
    dominanceIndex: top.marketShareIndex,
    trendDelta: top.trendDelta,
    trendLabel: top.trendLabel,
    score: top.score,
  })
}
