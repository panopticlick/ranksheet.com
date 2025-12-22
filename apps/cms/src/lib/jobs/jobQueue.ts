import { logger } from '@/lib/logger'
import { getDbPool } from '@/lib/db/pool'
import { refreshAllKeywords } from '@/lib/ranksheet/refreshAll'
import { refreshKeywordBySlug } from '@/lib/ranksheet/refreshKeyword'

export type JobType = 'refresh_one' | 'refresh_all'
export type JobStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED'

export type JobState = {
  id: string
  type: JobType
  status: JobStatus
  createdAt: string
  keyword?: string | null
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  detail?: unknown
}

type JobRunRow = {
  id: string
  job_name: string
  keyword_slug: string | null
  status: string
  queued_at: string | Date
  started_at: string | Date | null
  finished_at: string | Date | null
  duration_ms: number | null
  detail: unknown
}

declare global {
  // Ensure only one worker runs per Node process.
  // Next.js dev may reload modules but `globalThis` survives.
  var __rsJobWorkerRunning: boolean | undefined
  var __rsJobWorkerLastKickAtMs: number | undefined
}

function toIso(input: string | Date | null | undefined): string | undefined {
  if (!input) return undefined
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

function safeParseJson(value: unknown): unknown {
  if (!value) return value
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown
    } catch {
      return value
    }
  }
  return value
}

function rowToState(row: JobRunRow): JobState {
  return {
    id: row.id,
    type: row.job_name as JobType,
    status: row.status as JobStatus,
    createdAt: toIso(row.queued_at) ?? new Date().toISOString(),
    keyword: row.keyword_slug,
    startedAt: toIso(row.started_at) ?? undefined,
    finishedAt: toIso(row.finished_at) ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    detail: safeParseJson(row.detail),
  }
}

// Unused for now - keeping for potential future use
// @ts-expect-error - Keeping this function for future use
async function _findExistingJob(args: {
  type: JobType
  keywordSlug?: string
  maxAgeMinutes: number
}): Promise<string | null> {
  const pool = getDbPool()
  const keywordSlug = args.keywordSlug ?? null

  const res = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM ranksheet.job_runs
      WHERE job_name = $1
        AND status = ANY($2::text[])
        AND queued_at > NOW() - ($3 || ' minutes')::interval
        AND ($4::text IS NULL OR keyword_slug = $4::text)
      ORDER BY queued_at DESC
      LIMIT 1
    `,
    [args.type, ['QUEUED', 'RUNNING'], String(args.maxAgeMinutes), keywordSlug],
  )
  return res.rows[0]?.id ?? null
}

export async function enqueueRefreshOne(slug: string): Promise<string> {
  const keyword = slug.trim()
  if (!keyword) throw new Error('invalid_slug')

  const pool = getDbPool()

  // Use INSERT ... ON CONFLICT to atomically handle race conditions
  // This eliminates the race between findExistingJob and INSERT
  const res = await pool.query<{ id: string; is_new: boolean }>(
    `
      WITH existing AS (
        SELECT id, FALSE as is_new
        FROM ranksheet.job_runs
        WHERE job_name = 'refresh_one'
          AND keyword_slug = $1
          AND status = ANY($2::text[])
          AND queued_at > NOW() - interval '30 minutes'
        ORDER BY queued_at DESC
        LIMIT 1
      ),
      inserted AS (
        INSERT INTO ranksheet.job_runs (job_name, keyword_slug, status, detail)
        SELECT 'refresh_one', $1, 'QUEUED', $3::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM existing)
        RETURNING id, TRUE as is_new
      )
      SELECT * FROM existing
      UNION ALL
      SELECT * FROM inserted
      LIMIT 1
    `,
    [keyword, ['QUEUED', 'RUNNING'], JSON.stringify({ keyword })],
  )

  const row = res.rows[0]
  if (!row?.id) throw new Error('job_enqueue_failed')

  if (row.is_new) {
    logger.debug({ jobId: row.id, keyword }, 'job_enqueued_new')
  } else {
    logger.debug({ jobId: row.id, keyword }, 'job_already_exists')
  }

  void runWorkerOnce().catch((err) => logger.error({ err }, 'job_worker_error'))
  return row.id
}

export async function enqueueRefreshAll(args: { concurrency: number; limit?: number }): Promise<string> {
  const concurrency = Math.max(1, Math.min(10, Math.floor(args.concurrency)))
  const limit = typeof args.limit === 'number' ? Math.max(1, Math.min(2000, Math.floor(args.limit))) : undefined

  const pool = getDbPool()

  // Use INSERT ... ON CONFLICT to atomically handle race conditions
  const res = await pool.query<{ id: string; is_new: boolean }>(
    `
      WITH existing AS (
        SELECT id, FALSE as is_new
        FROM ranksheet.job_runs
        WHERE job_name = 'refresh_all'
          AND status = ANY($1::text[])
          AND queued_at > NOW() - interval '6 hours'
        ORDER BY queued_at DESC
        LIMIT 1
      ),
      inserted AS (
        INSERT INTO ranksheet.job_runs (job_name, status, detail)
        SELECT 'refresh_all', 'QUEUED', $2::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM existing)
        RETURNING id, TRUE as is_new
      )
      SELECT * FROM existing
      UNION ALL
      SELECT * FROM inserted
      LIMIT 1
    `,
    [['QUEUED', 'RUNNING'], JSON.stringify({ concurrency, limit })],
  )

  const row = res.rows[0]
  if (!row?.id) throw new Error('job_enqueue_failed')

  if (row.is_new) {
    logger.debug({ jobId: row.id, concurrency, limit }, 'refresh_all_enqueued_new')
  } else {
    logger.debug({ jobId: row.id }, 'refresh_all_already_exists')
  }

  void runWorkerOnce().catch((err) => logger.error({ err }, 'job_worker_error'))
  return row.id
}

export async function getJobState(id: string): Promise<JobState | null> {
  const pool = getDbPool()
  const res = await pool.query<JobRunRow>(
    `
      SELECT id, job_name, keyword_slug, status, queued_at, started_at, finished_at, duration_ms, detail
      FROM ranksheet.job_runs
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  )
  const row = res.rows[0]
  if (!row) return null
  return rowToState(row)
}

export function kickJobWorker(): void {
  const now = Date.now()
  const last = globalThis.__rsJobWorkerLastKickAtMs ?? 0
  if (now - last < 10_000) return
  globalThis.__rsJobWorkerLastKickAtMs = now

  void runWorkerOnce().catch((err) => logger.error({ err }, 'job_worker_error'))
}

async function claimNextQueuedJob(): Promise<JobRunRow | null> {
  const pool = getDbPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const res = await client.query<JobRunRow>(
      `
        SELECT id, job_name, keyword_slug, status, queued_at, started_at, finished_at, duration_ms, detail
        FROM ranksheet.job_runs
        WHERE status = 'QUEUED'
        ORDER BY queued_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `,
    )
    const job = res.rows[0]
    if (!job) {
      await client.query('COMMIT')
      return null
    }

    await client.query(
      `
        UPDATE ranksheet.job_runs
        SET status = 'RUNNING',
            started_at = NOW()
        WHERE id = $1
      `,
      [job.id],
    )

    await client.query('COMMIT')
    return job
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

async function markJobFinished(args: {
  id: string
  status: JobStatus
  durationMs: number
  detail: unknown
}): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `
      UPDATE ranksheet.job_runs
      SET status = $2,
          finished_at = NOW(),
          duration_ms = $3,
          detail = $4::jsonb
      WHERE id = $1
    `,
    [args.id, args.status, args.durationMs, JSON.stringify(args.detail)],
  )
}

async function runWorkerOnce(): Promise<void> {
  if (globalThis.__rsJobWorkerRunning) return
  globalThis.__rsJobWorkerRunning = true

  try {
    // Best-effort cleanup in case the process crashed mid-job and the row was never finalized.
    try {
      const pool = getDbPool()
      await pool.query(
        `
          UPDATE ranksheet.job_runs
          SET status = 'FAILED',
              finished_at = NOW(),
              duration_ms = COALESCE(
                duration_ms,
                (EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000)::int
              ),
              detail = COALESCE(detail, '{}'::jsonb) || jsonb_build_object('error', 'stale_job')
          WHERE status = 'RUNNING'
            AND started_at IS NOT NULL
            AND started_at < NOW() - interval '12 hours'
        `,
      )
    } catch (err) {
      logger.warn({ err }, 'job_worker_stale_cleanup_failed')
    }

    while (true) {
      const claimed = await claimNextQueuedJob()
      if (!claimed) {
        // No jobs available - wait 1 second before checking again
        // This prevents CPU spinning and reduces database load
        await new Promise((resolve) => setTimeout(resolve, 1000))
        continue
      }

      const startedAt = Date.now()
      const job = rowToState(claimed)

      logger.info({ jobId: job.id, type: job.type, keyword: job.keyword ?? undefined }, 'job_start')

      try {
        if (job.type === 'refresh_one') {
          const keyword = (job.keyword ?? '').trim()
          const result = await refreshKeywordBySlug({ slug: keyword })

          const detail = {
            ...(typeof job.detail === 'object' && job.detail ? (job.detail as Record<string, unknown>) : {}),
            result,
          }

          await markJobFinished({
            id: job.id,
            status: result.ok ? 'SUCCESS' : 'FAILED',
            durationMs: Date.now() - startedAt,
            detail,
          })

          // Short delay before checking for next job (prevent tight loop)
          await new Promise((resolve) => setTimeout(resolve, 100))
          continue
        }

        if (job.type === 'refresh_all') {
          const input = safeParseJson(job.detail) as { concurrency?: number; limit?: number } | null
          const concurrency = Math.max(1, Math.min(10, Math.floor(input?.concurrency ?? 3)))
          const limit = typeof input?.limit === 'number' ? input.limit : undefined

          const result = await refreshAllKeywords({ concurrency, limit })

          const sampleErrors = result.results
            .filter((r) => !r.ok)
            .slice(0, 20)
            .map((r) => ({ slug: r.slug, error: r.error, detail: r.ok ? undefined : r.detail }))

          const detail = {
            ...(typeof job.detail === 'object' && job.detail ? (job.detail as Record<string, unknown>) : {}),
            summary: {
              total: result.total,
              success: result.success,
              failed: result.failed,
              sampleErrors,
            },
          }

          await markJobFinished({
            id: job.id,
            status: result.failed === 0 ? 'SUCCESS' : 'FAILED',
            durationMs: Date.now() - startedAt,
            detail,
          })

          // Short delay before checking for next job
          await new Promise((resolve) => setTimeout(resolve, 100))
          continue
        }

        await markJobFinished({
          id: job.id,
          status: 'FAILED',
          durationMs: Date.now() - startedAt,
          detail: {
            ...(typeof job.detail === 'object' && job.detail ? (job.detail as Record<string, unknown>) : {}),
            error: 'unknown_job_type',
          },
        })

        // Short delay before checking for next job
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown'
        await markJobFinished({
          id: job.id,
          status: 'FAILED',
          durationMs: Date.now() - startedAt,
          detail: {
            ...(typeof job.detail === 'object' && job.detail ? (job.detail as Record<string, unknown>) : {}),
            error: message,
          },
        })
      } finally {
        logger.info({ jobId: job.id, type: job.type }, 'job_done')
      }
    }
  } finally {
    globalThis.__rsJobWorkerRunning = false
  }
}
