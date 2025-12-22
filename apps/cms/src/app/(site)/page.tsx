import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '48px 16px' }}>
      <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -0.2 }}>RankSheet CMS</h1>
      <p style={{ marginTop: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
        Payload Admin + Public/Admin API for ranksheet.com.
      </p>

      <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
        <Link
          href="/admin"
          style={{
            border: '1px solid var(--border)',
            padding: 14,
            borderRadius: 12,
            display: 'block',
          }}
        >
          Open Admin →
        </Link>
        <Link
          href="/api/healthz"
          style={{
            border: '1px solid var(--border)',
            padding: 14,
            borderRadius: 12,
            display: 'block',
          }}
        >
          Health Check →
        </Link>
      </div>
    </main>
  )
}
