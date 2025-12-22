import React from 'react'
import Link from 'next/link'

import { getClickAnalyticsOverview } from '@/lib/analytics/clicks'

function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

export async function ClickAnalyticsWidget() {
  try {
    const data = await getClickAnalyticsOverview()

    return (
      <section
        style={{
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 14,
          marginTop: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 800 }}>Click Analytics</div>
            <div style={{ marginTop: 4, color: 'var(--muted)', fontSize: 12 }}>
              24h: <span style={{ fontWeight: 700, color: 'var(--fg)' }}>{formatInt(data.totals.clicks24h)}</span> • 7d:{' '}
              <span style={{ fontWeight: 700, color: 'var(--fg)' }}>{formatInt(data.totals.clicks7d)}</span>
            </div>
          </div>
          <Link href="/admin/clicks" style={{ textDecoration: 'underline', fontSize: 12 }}>
            Open →
          </Link>
        </div>

        {data.topKeywords7d.length ? (
          <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Top keywords (7d)</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {data.topKeywords7d.slice(0, 5).map((k) => (
                <div key={k.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <code style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.key}</code>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>{formatInt(k.clicks)}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    )
  } catch {
    return (
      <section
        style={{
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 14,
          marginTop: 16,
          color: 'var(--muted)',
        }}
      >
        <div style={{ fontWeight: 800, color: 'var(--fg)' }}>Click Analytics</div>
        <div style={{ marginTop: 6 }}>Unable to load right now.</div>
        <Link
          href="/admin/clicks"
          style={{ textDecoration: 'underline', fontSize: 12, marginTop: 8, display: 'inline-block' }}
        >
          Open →
        </Link>
      </section>
    )
  }
}
