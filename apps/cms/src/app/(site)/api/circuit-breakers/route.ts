import { NextResponse } from 'next/server'
import { getCircuitBreakerHealth } from '@/lib/http/resilientFetch'

/**
 * GET /api/circuit-breakers
 * Returns health status of all circuit breakers
 */
export async function GET() {
  const health = getCircuitBreakerHealth()

  return NextResponse.json({
    ok: true,
    circuitBreakers: health,
  })
}
