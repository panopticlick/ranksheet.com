function normalizeAsin(input: string): string {
  return input.trim().toUpperCase()
}

function normalizeSlug(input: string): string {
  return input.trim()
}

export function buildGoToAmazonPath(args: {
  asin: string
  slug: string
  rank?: number
  position?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
}): string {
  const asin = normalizeAsin(args.asin)
  const slug = normalizeSlug(args.slug)

  const url = new URL('https://ranksheet.local')
  url.pathname = `/go/${encodeURIComponent(asin)}`
  url.searchParams.set('slug', slug)

  if (typeof args.rank === 'number' && Number.isFinite(args.rank)) {
    url.searchParams.set('rank', String(Math.trunc(args.rank)))
  }

  if (args.position) url.searchParams.set('pos', args.position)
  if (args.utmSource) url.searchParams.set('utm_source', args.utmSource)
  if (args.utmMedium) url.searchParams.set('utm_medium', args.utmMedium)
  if (args.utmCampaign) url.searchParams.set('utm_campaign', args.utmCampaign)

  return `${url.pathname}${url.search}`
}

