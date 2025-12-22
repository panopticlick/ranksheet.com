import { ImageResponse } from 'next/og'

import { OG_SIZE } from '@/lib/og/ogImage'

type TickerOgArgs = {
  slug: string
  keyword: string
  categoryLabel: string
  dataPeriod?: string | null
  updatedAt?: string | null
  leaderTitle?: string | null
  leaderImage?: string | null
  dominanceIndex?: number | null
  trendDelta?: number | null
  trendLabel?: string | null
  score?: number | null
}

function clampText(input: string, max: number): string {
  const v = input.trim()
  if (v.length <= max) return v
  return `${v.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function trendBadge(delta: number | null | undefined, label: string | null | undefined): { text: string; bg: string; fg: string } {
  const d = Number.isFinite(delta) ? Math.trunc(delta as number) : 0
  const isUp = d > 0
  const isDown = d < 0
  const arrow = isUp ? '▲' : isDown ? '▼' : '—'
  const t = `${arrow} ${isDown ? Math.abs(d) : d} ${label ?? ''}`.trim()

  if (isUp) return { text: t, bg: '#ecfdf5', fg: '#047857' } // emerald
  if (isDown) return { text: t, bg: '#fff1f2', fg: '#be123c' } // rose
  return { text: t, bg: '#eff6ff', fg: '#2563eb' } // blue
}

function safeInt(value: number | null | undefined): number | null {
  if (!Number.isFinite(value)) return null
  const v = Math.round(value as number)
  return Math.max(0, Math.min(100, v))
}

export function makeTickerOgImage(args: TickerOgArgs): ImageResponse {
  const keyword = clampText(args.keyword || 'RankSheet', 54)
  const leaderTitle = args.leaderTitle ? clampText(args.leaderTitle, 74) : null
  const slug = clampText(args.slug, 60)
  const period = args.dataPeriod ? clampText(args.dataPeriod, 18) : null
  const updatedAt = args.updatedAt ? clampText(args.updatedAt, 24) : null

  const dominance = safeInt(args.dominanceIndex)
  const score = safeInt(args.score)
  const trend = trendBadge(args.trendDelta ?? null, args.trendLabel ?? null)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 56,
          backgroundColor: '#fafafa',
          backgroundImage:
            'linear-gradient(to right, rgba(0,0,0,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.035) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          color: '#0a0a0a',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: 'linear-gradient(135deg, #2563eb 0%, #0ea5e9 55%, #10b981 100%)',
                }}
              />
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5 }}>RankSheet</div>
              <div
                style={{
                  fontSize: 13,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  color: '#334155',
                }}
              >
                Market Ticker
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: 999,
                  background: 'rgba(15, 23, 42, 0.06)',
                  border: '1px solid rgba(15, 23, 42, 0.10)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#0f172a',
                  width: 'fit-content',
                }}
              >
                {clampText(args.categoryLabel || 'Category', 36)}
              </div>

              {period ? (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 999,
                    background: 'rgba(255, 255, 255, 0.7)',
                    border: '1px solid rgba(15, 23, 42, 0.10)',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#334155',
                    width: 'fit-content',
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  }}
                >
                  Period: {period}
                </div>
              ) : null}

              {updatedAt ? (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 999,
                    background: 'rgba(255, 255, 255, 0.7)',
                    border: '1px solid rgba(15, 23, 42, 0.10)',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#334155',
                    width: 'fit-content',
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  }}
                >
                  Updated: {updatedAt}
                </div>
              ) : null}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 999,
                background: '#eff6ff',
                border: '1px solid rgba(37,99,235,0.20)',
                fontSize: 14,
                fontWeight: 800,
                color: '#1d4ed8',
              }}
            >
              No raw % shares
            </div>
            <div style={{ fontSize: 14, color: '#475569' }}>Data‑dense market snapshots</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
          <div
            style={{
              width: 260,
              height: 260,
              borderRadius: 28,
              overflow: 'hidden',
              background: 'rgba(15, 23, 42, 0.06)',
              border: '1px solid rgba(15, 23, 42, 0.10)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {args.leaderImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={args.leaderImage}
                alt=""
                width={260}
                height={260}
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <div style={{ fontSize: 18, fontWeight: 800, color: '#334155' }}>Rank #1</div>
            )}

            <div
              style={{
                position: 'absolute',
                left: 16,
                top: 16,
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 10px',
                borderRadius: 999,
                background: 'rgba(0,0,0,0.75)',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 800,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              }}
            >
              #1
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 900,
                letterSpacing: 2,
                textTransform: 'uppercase',
                color: '#64748b',
              }}
            >
              Market Leader
            </div>
            <div style={{ fontSize: 52, fontWeight: 950, letterSpacing: -1.2, lineHeight: 1.05 }}>
              {leaderTitle ?? keyword}
            </div>
            <div style={{ fontSize: 22, lineHeight: 1.35, color: '#334155' }}>
              Top products for “{keyword}”, ranked by normalized shopper‑behavior indices.
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
              {dominance != null ? (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 16,
                    background: '#ecfdf5',
                    border: '1px solid rgba(16,185,129,0.25)',
                    color: '#047857',
                    fontSize: 18,
                    fontWeight: 900,
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  }}
                >
                  Dominance IDX {dominance}
                </div>
              ) : null}

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 16,
                  background: trend.bg,
                  border: '1px solid rgba(15, 23, 42, 0.10)',
                  color: trend.fg,
                  fontSize: 18,
                  fontWeight: 900,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                }}
              >
                Trend {trend.text}
              </div>

              {score != null ? (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 16,
                    background: 'rgba(15, 23, 42, 0.06)',
                    border: '1px solid rgba(15, 23, 42, 0.10)',
                    color: '#0f172a',
                    fontSize: 18,
                    fontWeight: 900,
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  }}
                >
                  Score {score}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              fontSize: 16,
              color: '#475569',
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            }}
          >
            ranksheet.com/{slug}
          </div>
          <div style={{ fontSize: 16, color: '#475569' }}>Built for fast, high‑intent decisions</div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  )
}

