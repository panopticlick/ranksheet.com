function trimOrEmpty(value: string | null | undefined): string {
  return (value ?? '').trim()
}

export function amazonProductUrl(args: { asin: string; tag?: string }): string {
  const asin = trimOrEmpty(args.asin).toUpperCase()
  const tag = trimOrEmpty(args.tag)

  const url = new URL(`https://www.amazon.com/dp/${encodeURIComponent(asin)}`)
  if (tag) url.searchParams.set('tag', tag)
  url.searchParams.set('psc', '1')
  return url.toString()
}

