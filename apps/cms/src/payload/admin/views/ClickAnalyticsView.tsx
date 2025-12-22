import React from 'react'

import { getClickAnalyticsOverview } from '@/lib/analytics/clicks'

function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function TrendChart(props: { values: number[]; labels: string[] }) {
  const width = 980
  const height = 180
  const padding = 14

  const values = props.values
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 0
  const span = Math.max(1, max - min)
  const w = Math.max(1, width - padding * 2)
  const h = Math.max(1, height - padding * 2)

  const points = values.map((v, idx) => {
    const x = padding + (w * idx) / Math.max(1, values.length - 1)
    const t = (v - min) / span
    const y = padding + (1 - t) * h
    return { x, y }
  })

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto" role="img" aria-label="Clicks trend (30d)">
        <rect x={0} y={0} width={width} height={height} fill="transparent" />
        <path d={d} fill="none" stroke="currentColor" strokeWidth={2.5} />
        {points.map((p, idx) => (
          <circle key={idx} cx={p.x} cy={p.y} r={3} fill="currentColor" opacity={0.8} />
        ))}

        {props.labels.length ? (
          <text x={padding} y={height - 8} fontSize={11} fill="currentColor" opacity={0.7}>
            {props.labels[0]}
          </text>
        ) : null}
        {props.labels.length ? (
          <text x={width - padding} y={height - 8} fontSize={11} fill="currentColor" opacity={0.7} textAnchor="end">
            {props.labels[props.labels.length - 1]}
          </text>
        ) : null}
      </svg>
    </div>
  )
}

function Table(props: { title: string; headers: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: 14, borderBottom: '1px solid var(--border)', fontWeight: 700 }}>{props.title}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 12 }}>
              {props.headers.map((h) => (
                <th key={h} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((r, idx) => (
              <tr key={idx}>
                {r.map((cell, i) => (
                  <td key={i} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ClickAnalyticsView() {
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 16px' }}>
      <h1 style={{ margin: 0, fontSize: 26, letterSpacing: -0.2 }}>Click Analytics</h1>
      <p style={{ marginTop: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
        Affiliate click tracking for ranksheet.com (no conversion tracking). Powered by <code>affiliate_clicks</code>{' '}
        and <code>affiliate_clicks_daily</code>.
      </p>
      <ClickAnalyticsContent />
    </main>
  )
}

async function ClickAnalyticsContent() {
  try {
    const data = await getClickAnalyticsOverview()

    const cards = [
      { label: 'Clicks (24h)', value: data.totals.clicks24h },
      { label: 'Clicks (7d)', value: data.totals.clicks7d },
      { label: 'Clicks (30d)', value: data.totals.clicks30d },
      { label: 'Clicks (all‑time)', value: data.totals.clicksAllTime },
    ]

    const values = data.series30d.map((p) => p.clicks)
    const labels = data.series30d.map((p) => p.day)

    return (
      <div style={{ marginTop: 18, display: 'grid', gap: 16 }}>
        <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
          {cards.map((c) => (
            <div
              key={c.label}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{c.label}</div>
              <div style={{ marginTop: 6, fontSize: 26, fontWeight: 800 }}>{formatInt(c.value)}</div>
            </div>
          ))}
        </section>

        <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 800 }}>Daily clicks (last 30 days)</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sum of all slugs & ASINs</div>
          </div>
          <div style={{ marginTop: 10 }}>
            <TrendChart values={values} labels={[labels[0] ?? '', labels[labels.length - 1] ?? '']} />
          </div>
        </section>

        <section style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
          <Table
            title="Top keywords (7d)"
            headers={['Keyword slug', 'Clicks', 'Open']}
            rows={data.topKeywords7d.map((r) => [
              <code key="k">{r.key}</code>,
              <span key="c" style={{ fontWeight: 700 }}>
                {formatInt(r.clicks)}
              </span>,
              <a
                key="o"
                href={`https://ranksheet.com/${encodeURIComponent(r.key)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'underline' }}
              >
                Web
              </a>,
            ])}
          />

          <Table
            title="Top ASINs (7d)"
            headers={['ASIN', 'Clicks', 'Open']}
            rows={data.topAsins7d.map((r) => [
              <code key="k">{r.key}</code>,
              <span key="c" style={{ fontWeight: 700 }}>
                {formatInt(r.clicks)}
              </span>,
              <a
                key="o"
                href={`https://www.amazon.com/dp/${encodeURIComponent(r.key)}`}
                target="_blank"
                rel="nofollow noopener noreferrer"
                style={{ textDecoration: 'underline' }}
              >
                Amazon
              </a>,
            ])}
          />
        </section>

        <section>
          <Table
            title="Position breakdown (last 7 days)"
            headers={['Position', 'Clicks']}
            rows={data.topPositions7d.map((r) => [
              <code key="k">{r.key}</code>,
              <span key="c" style={{ fontWeight: 700 }}>
                {formatInt(r.clicks)}
              </span>,
            ])}
          />
        </section>

        <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.6 }}>
          Notes:
          <ul style={{ marginTop: 6 }}>
            <li>All click counts are non‑deduplicated (each redirect counts as a click).</li>
            <li>
              Rate limiting / anti‑abuse is handled on the public click endpoint; consider WAF rules for production.
            </li>
          </ul>
        </div>
      </div>
    )
  } catch (err) {
    return (
      <div
        style={{
          marginTop: 18,
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 14,
          color: 'var(--muted)',
        }}
      >
        <div style={{ fontWeight: 800, color: 'var(--fg)' }}>Unable to load click analytics</div>
        <div style={{ marginTop: 6, lineHeight: 1.6 }}>
          {err instanceof Error ? err.message : 'Unknown error'}
        </div>
      </div>
    )
  }
}
