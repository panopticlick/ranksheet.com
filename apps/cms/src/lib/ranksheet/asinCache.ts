/**
 * ASIN Cache - Local caching layer to reduce Express API calls
 *
 * Purpose:
 * - Reduce Express API calls by 90%+
 * - Cache stable fields (title, brand, image, parent_asin) for 7-30 days
 * - Support negative caching (NOT_FOUND status) to avoid repeated API calls for invalid ASINs
 * - Enable offline development/testing with cached data
 *
 * Optimization: Negative Caching
 * - When Express API returns null/undefined for an ASIN, cache it as NOT_FOUND
 * - NOT_FOUND entries expire after 7 days (shorter TTL than valid entries)
 * - Prevents cache penetration: invalid ASINs won't trigger repeated API calls
 */

import { getDbPool } from '@/lib/db/pool'
import { logger } from '@/lib/logger'

const log = logger.child({ module: 'asin-cache' })

export type AsinCacheStatus = 'EXISTS' | 'NOT_FOUND'

export interface AsinCacheEntry {
  asin: string
  status: AsinCacheStatus
  title: string | null
  brand: string | null
  imageUrl: string | null
  parentAsin: string | null
  priceCents: number | null
  priceCurrency: string
  isPrime: boolean | null
  source: string
  fetchedAt: Date
  expiresAt: Date | null
}

export interface AsinCacheInput {
  asin: string
  status?: AsinCacheStatus
  title?: string
  brand?: string
  imageUrl?: string
  parentAsin?: string
  priceCents?: number
  priceCurrency?: string
  isPrime?: boolean
  ttlDays?: number
}

/**
 * Get ASINs from cache (including negative cache entries)
 * @param asins - Array of ASINs to fetch
 * @returns Map of ASIN -> cache entry (includes both EXISTS and NOT_FOUND)
 */
export async function getAsinCache(asins: string[]): Promise<Map<string, AsinCacheEntry>> {
  if (asins.length === 0) return new Map()

  const pool = getDbPool()
  const now = new Date()

  const result = await pool.query<{
    asin: string
    status: AsinCacheStatus | null
    title: string | null
    brand: string | null
    image_url: string | null
    parent_asin: string | null
    price_cents: number | null
    price_currency: string
    is_prime: boolean | null
    source: string
    fetched_at: Date
    expires_at: Date | null
  }>(
    `
    SELECT asin, status, title, brand, image_url, parent_asin, price_cents, price_currency, is_prime, source, fetched_at, expires_at
    FROM ranksheet.asin_cache
    WHERE asin = ANY($1)
      AND (expires_at IS NULL OR expires_at > $2)
  `,
    [asins, now],
  )

  const cacheMap = new Map<string, AsinCacheEntry>()
  let existsCount = 0
  let notFoundCount = 0

  for (const row of result.rows) {
    const status = row.status ?? 'EXISTS'
    cacheMap.set(row.asin, {
      asin: row.asin,
      status,
      title: row.title,
      brand: row.brand,
      imageUrl: row.image_url,
      parentAsin: row.parent_asin,
      priceCents: row.price_cents,
      priceCurrency: row.price_currency,
      isPrime: row.is_prime,
      source: row.source,
      fetchedAt: row.fetched_at,
      expiresAt: row.expires_at,
    })

    if (status === 'EXISTS') existsCount++
    else notFoundCount++
  }

  log.debug(
    { asinsRequested: asins.length, asinsFound: cacheMap.size, existsCount, notFoundCount },
    'ASIN cache lookup'
  )

  return cacheMap
}

/**
 * Upsert ASINs into cache (supports both positive and negative caching)
 * @param entries - Array of ASIN data to cache
 *
 * Examples:
 * - Positive cache: { asin: 'B0CHBQTL9Z', status: 'EXISTS', title: 'Product Title', ttlDays: 30 }
 * - Negative cache: { asin: 'INVALID123', status: 'NOT_FOUND', ttlDays: 7 }
 */
export async function upsertAsinCache(entries: AsinCacheInput[]): Promise<void> {
  if (entries.length === 0) return

  const pool = getDbPool()
  const now = new Date()

  // Build bulk upsert query
  const values: unknown[] = []
  const placeholders: string[] = []

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!
    const status = entry.status ?? 'EXISTS'

    // Default TTLs:
    // - EXISTS: 30 days (stable product data)
    // - NOT_FOUND: 7 days (revalidate sooner in case product becomes available)
    const defaultTtl = status === 'EXISTS' ? 30 : 7
    const ttl = entry.ttlDays ?? defaultTtl

    const expiresAt = new Date(now.getTime() + ttl * 24 * 60 * 60 * 1000)

    const offset = i * 10
    placeholders.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`,
    )

    values.push(
      entry.asin,
      status,
      entry.title ?? null,
      entry.brand ?? null,
      entry.imageUrl ?? null,
      entry.parentAsin ?? null,
      entry.priceCents ?? null,
      entry.priceCurrency ?? 'USD',
      typeof entry.isPrime === 'boolean' ? entry.isPrime : null,
      expiresAt,
    )
  }

  await pool.query(
    `
    INSERT INTO ranksheet.asin_cache (asin, status, title, brand, image_url, parent_asin, price_cents, price_currency, is_prime, expires_at)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (asin) DO UPDATE SET
      status = EXCLUDED.status,
      title = EXCLUDED.title,
      brand = EXCLUDED.brand,
      image_url = EXCLUDED.image_url,
      parent_asin = EXCLUDED.parent_asin,
      price_cents = EXCLUDED.price_cents,
      price_currency = EXCLUDED.price_currency,
      is_prime = EXCLUDED.is_prime,
      expires_at = EXCLUDED.expires_at,
      fetched_at = NOW(),
      updated_at = NOW()
  `,
    values,
  )

  const existsCount = entries.filter((e) => (e.status ?? 'EXISTS') === 'EXISTS').length
  const notFoundCount = entries.length - existsCount

  log.info({ total: entries.length, existsCount, notFoundCount }, 'Upserted ASIN cache entries')
}

/**
 * Clean up expired cache entries
 * @param olderThanDays - Remove entries older than N days (default: 60)
 * @returns Number of deleted entries
 */
export async function cleanExpiredCache(olderThanDays = 60): Promise<number> {
  const pool = getDbPool()
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)

  const result = await pool.query<{ count: string }>(
    `
    WITH deleted AS (
      DELETE FROM ranksheet.asin_cache
      WHERE expires_at < $1
      RETURNING asin
    )
    SELECT COUNT(*) as count FROM deleted
  `,
    [cutoff],
  )

  const count = parseInt(result.rows[0]?.count ?? '0', 10)
  log.info({ count, olderThanDays }, 'Cleaned expired ASIN cache entries')

  return count
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  total: number
  exists: number
  notFound: number
  expired: number
  validUntil7Days: number
}> {
  const pool = getDbPool()
  const now = new Date()
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const result = await pool.query<{
    total: string
    exists: string
    not_found: string
    expired: string
    valid_until_7_days: string
  }>(
    `
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'EXISTS') as exists,
      COUNT(*) FILTER (WHERE status = 'NOT_FOUND') as not_found,
      COUNT(*) FILTER (WHERE expires_at < $1) as expired,
      COUNT(*) FILTER (WHERE expires_at > $1 AND expires_at <= $2) as valid_until_7_days
    FROM ranksheet.asin_cache
  `,
    [now, in7Days],
  )

  const row = result.rows[0]!
  return {
    total: parseInt(row.total, 10),
    exists: parseInt(row.exists, 10),
    notFound: parseInt(row.not_found, 10),
    expired: parseInt(row.expired, 10),
    validUntil7Days: parseInt(row.valid_until_7_days, 10),
  }
}
