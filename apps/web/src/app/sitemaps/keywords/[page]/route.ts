import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getPublicKeywords } from '@/lib/cms/public'
import { env } from '@/lib/env'

const PAGE_SIZE = 500

const ParamsSchema = z.object({
  page: z.coerce.number().int().min(0).max(10_000),
})

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

export async function GET(_: Request, context: { params: Promise<{ page: string }> }) {
  const params = await context.params
  const parsed = ParamsSchema.safeParse({ page: params.page })
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_page' }, { status: 400 })

  const base = env.SITE_URL.replace(/\/$/, '')
  const offset = parsed.data.page * PAGE_SIZE

  const res = await getPublicKeywords({ limit: PAGE_SIZE, offset }, { revalidateSeconds: 3600 }).catch(() => ({
    keywords: [],
    total: 0,
  }))

  const urls: SitemapUrl[] = res.keywords.map((k) => ({
    loc: `${base}/${encodeURIComponent(k.slug)}`,
    lastmod: k.lastRefreshedAt || new Date().toISOString(),
    changefreq: 'daily',
    priority: '0.9'
  }))

  const xml = renderUrlset(urls)

  return new NextResponse(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}

