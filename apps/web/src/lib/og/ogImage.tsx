import { ImageResponse } from 'next/og'

export const OG_SIZE = { width: 1200, height: 630 } as const

type OgImageArgs = {
  title: string
  subtitle?: string
  kicker?: string
  footerLeft?: string
  footerRight?: string
}

function clampText(input: string, max: number): string {
  const v = input.trim()
  if (v.length <= max) return v
  return `${v.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

export function makeOgImage(args: OgImageArgs): ImageResponse {
  const title = clampText(args.title, 80)
  const subtitle = args.subtitle ? clampText(args.subtitle, 140) : ''
  const kicker = args.kicker ? clampText(args.kicker, 40) : ''
  const footerLeft = args.footerLeft ? clampText(args.footerLeft, 60) : ''
  const footerRight = args.footerRight ? clampText(args.footerRight, 60) : ''

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
          background: 'linear-gradient(135deg, #0b1220 0%, #111827 55%, #0b1220 100%)',
          color: '#ffffff',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 60%, #34d399 100%)',
                }}
              />
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>RankSheet</div>
            </div>

            {kicker ? (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.9)',
                  width: 'fit-content',
                }}
              >
                {kicker}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 8,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 999,
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.25)',
                fontSize: 14,
                fontWeight: 700,
                color: '#a7f3d0',
              }}
            >
              No raw % shares
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>Data‑driven Amazon rankings</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.05 }}>{title}</div>
          {subtitle ? (
            <div style={{ fontSize: 26, lineHeight: 1.35, color: 'rgba(255,255,255,0.85)', maxWidth: 980 }}>
              {subtitle}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.75)' }}>{footerLeft}</div>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.75)' }}>{footerRight}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  )
}

