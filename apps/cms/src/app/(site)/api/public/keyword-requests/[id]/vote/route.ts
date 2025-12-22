import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getDbPool } from '@/lib/db/pool'
import { enforceRateLimit } from '@/lib/security/rateLimit'
import { getClientIp, hashIp } from '@/lib/security/ip'

const ParamsSchema = z.object({
  id: z.coerce.number().int().min(1),
})

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(request, { name: 'public_keyword_request_vote', limit: 30, windowSeconds: 3600 })
  if (limited) return limited

  const params = await context.params
  const parsed = ParamsSchema.safeParse({ id: params.id })
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })

  const ip = getClientIp(request)
  if (!ip) return NextResponse.json({ ok: false, error: 'no_ip' }, { status: 400 })

  const ipHash = hashIp(ip)
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null

  const pool = getDbPool()

  const inserted = await pool.query<{ request_id: number }>(
    `
      INSERT INTO ranksheet.keyword_request_votes (request_id, user_ip_hash, user_agent)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
      RETURNING request_id
    `,
    [parsed.data.id, ipHash, userAgent],
  )

  const voted = inserted.rows.length > 0

  const res = voted
    ? await pool.query<{ votes: number }>(
        `
          UPDATE ranksheet.keyword_requests
          SET votes = COALESCE(votes, 0) + 1,
              last_voted_at = NOW(),
              updated_at = NOW()
          WHERE id = $1
          RETURNING votes::int AS votes
        `,
        [parsed.data.id],
      )
    : await pool.query<{ votes: number }>(
        `
          SELECT votes::int AS votes
          FROM ranksheet.keyword_requests
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.id],
      )

  const votes = res.rows[0]?.votes ?? 0

  return NextResponse.json({ ok: true, requestId: parsed.data.id, voted, votes })
}

