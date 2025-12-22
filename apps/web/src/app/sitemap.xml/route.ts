import { NextResponse } from 'next/server'

import { getPublicKeywords } from '@/lib/cms/public'
import { env } from '@/lib/env'

const PAGE_SIZE = 500

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function GET() {
  const base = env.SITE_URL.replace(/\/$/, '')
  const now = new Date().toISOString()

  const firstPage = await getPublicKeywords({ limit: 1, offset: 0 }, { revalidateSeconds: 3600 }).catch(() => ({
    keywords: [],
    total: 0,
  }))

  const pages = Math.max(1, Math.ceil(firstPage.total / PAGE_SIZE))

  const sitemaps = [
    `${base}/sitemaps/static`,
    `${base}/sitemaps/categories`,
    ...Array.from({ length: pages }, (_, i) => `${base}/sitemaps/keywords/${i}`),
  ]

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemaps.map((loc) => `  <sitemap><loc>${xmlEscape(loc)}</loc><lastmod>${now}</lastmod></sitemap>`),
    '</sitemapindex>',
    '',
  ].join('\n')

  return new NextResponse(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
