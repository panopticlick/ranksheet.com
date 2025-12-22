import { makeOgImage } from '@/lib/og/ogImage'

export const runtime = 'edge'

export default function Image() {
  return makeOgImage({
    title: 'Data‑Driven Amazon Rankings',
    subtitle: 'Discover what shoppers click and buy—without exposing raw percentage shares.',
    kicker: 'ranksheet.com',
    footerLeft: 'Market Share Index · Buyer Trust Index · Trend',
    footerRight: 'Updated weekly',
  })
}

