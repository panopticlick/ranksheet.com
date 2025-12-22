import { NextResponse } from 'next/server'

import { env } from '@/lib/env'
import { CATEGORIES } from '@/lib/ranksheet/categories'

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

type SitemapUrl = { loc: string; lastmod?: string; changefreq?: string; priority?: string }

function renderUrlset(urls: SitemapUrl[]): string {
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
  for (const u of urls) {
    lines.push('  <url>')
    lines.push(`    <loc>${xmlEscape(u.loc)}</loc>`)
    if (u.lastmod) lines.push(`    <lastmod>${xmlEscape(u.lastmod)}</lastmod>`)
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
  const now = new Date().toISOString()

  const urls: SitemapUrl[] = [
    { loc: `${base}/`, lastmod: now, changefreq: 'daily', priority: '1.0' },
    ...CATEGORIES.map((c) => ({
      loc: `${base}/category/${encodeURIComponent(c.key)}`,
      changefreq: 'daily',
      priority: '0.8'
    })),
    { loc: `${base}/search`, changefreq: 'weekly', priority: '0.7' },
    { loc: `${base}/requests`, changefreq: 'weekly', priority: '0.6' },
    { loc: `${base}/privacy`, changefreq: 'monthly', priority: '0.3' },
    { loc: `${base}/terms`, changefreq: 'monthly', priority: '0.3' },
    { loc: `${base}/affiliate-disclosure`, changefreq: 'monthly', priority: '0.3' },
  ]

  const xml = renderUrlset(urls)

  return new NextResponse(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 's-maxage=21600, stale-while-revalidate=86400',
    },
  })
}

