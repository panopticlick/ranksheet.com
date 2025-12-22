import { NextResponse } from 'next/server'

import { getPublicKeywords } from '@/lib/cms/public'
import { env } from '@/lib/env'
import { CATEGORIES } from '@/lib/ranksheet/categories'

const PAGE_SIZE = 50
const MAX_PAGES_PER_CATEGORY = 1000

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

type SitemapUrl = { loc: string; changefreq?: string; priority?: string }

function renderUrlset(urls: SitemapUrl[]): string {
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
  for (const u of urls) {
    lines.push('  <url>')
    lines.push(`    <loc>${xmlEscape(u.loc)}</loc>`)
    if (u.changefreq) lines.push(`    <changefreq>${xmlEscape(u.changefreq)}</changefreq>`)
    if (u.priority) lines.push(`    <priority>${xmlEscape(u.priority)}</priority>`)
    lines.push('  </url>')
  }
  lines.push('</urlset>')
  lines.push('')
  return lines.join('\n')
}

export async function GET() {
  const base = env.SITE_URL.replace(/\/$/, '')

  const totals = await Promise.all(
    CATEGORIES.map(async (c) => {
      const res = await getPublicKeywords({ category: c.key, limit: 1, offset: 0 }, { revalidateSeconds: 21_600 }).catch(() => ({
        keywords: [],
        total: 0,
      }))
      return { key: c.key, total: Math.max(0, Math.trunc(res.total ?? 0)) }
    }),
  )

  const urls: SitemapUrl[] = []
  for (const item of totals) {
    // First page has higher priority
    urls.push({
      loc: `${base}/category/${encodeURIComponent(item.key)}`,
      changefreq: 'daily',
      priority: '0.8'
    })

    const pages = Math.min(MAX_PAGES_PER_CATEGORY, Math.max(1, Math.ceil(item.total / PAGE_SIZE)))
    for (let p = 2; p <= pages; p += 1) {
      urls.push({
        loc: `${base}/category/${encodeURIComponent(item.key)}?page=${p}`,
        changefreq: 'weekly',
        priority: '0.6'
      })
    }
  }

  const xml = renderUrlset(urls)
  return new NextResponse(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 's-maxage=21600, stale-while-revalidate=86400',
    },
  })
}

