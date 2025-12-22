import { z } from 'zod'

import { makeOgImage } from '@/lib/og/ogImage'
import { CATEGORIES, getCategoryLabel } from '@/lib/ranksheet/categories'

export const runtime = 'edge'

const ParamsSchema = z.object({
  category: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
})

export default async function Image(props: { params: Promise<{ category: string }> }) {
  const params = await props.params
  const parsed = ParamsSchema.safeParse({ category: params.category })
  const key = parsed.success ? parsed.data.category : 'other'

  const label = getCategoryLabel(key)
  const desc = CATEGORIES.find((c) => c.key === key)?.description ?? 'Browse data‑driven rankings by category.'

  return makeOgImage({
    title: `${label} rankings`,
    subtitle: `${desc} Explore sheets built from aggregated Amazon US search‑term behavior.`,
    kicker: 'Category',
    footerLeft: 'RankSheet.com',
    footerRight: 'Updated weekly',
  })
}

