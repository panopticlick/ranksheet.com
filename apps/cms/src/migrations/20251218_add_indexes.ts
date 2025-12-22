import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.execute({
    sql: sql`
    -- Keywords: Composite index for active priority-based refresh sorting
    -- Covers: WHERE is_active = true ORDER BY priority DESC, last_refreshed_at
    CREATE INDEX IF NOT EXISTS "idx_keywords_active_priority"
    ON "ranksheet"."keywords"("is_active", "priority" DESC)
    WHERE "is_active" = true;

    -- Keywords: Composite index for status and category filtering
    -- Covers: WHERE status = 'ACTIVE' AND category = 'electronics'
    CREATE INDEX IF NOT EXISTS "idx_keywords_status_category"
    ON "ranksheet"."keywords"("status", "category");

    -- RankSheets: Composite index for keyword_id and data_period lookups
    -- Covers: WHERE keyword = :id AND data_period = '2025-12'
    CREATE INDEX IF NOT EXISTS "idx_rank_sheets_keyword_period"
    ON "ranksheet"."rank_sheets"("keyword_id", "data_period");

    -- RankSheets: Index for data_period sorting (latest sheets)
    -- Covers: ORDER BY data_period DESC
    CREATE INDEX IF NOT EXISTS "idx_rank_sheets_period"
    ON "ranksheet"."rank_sheets"("data_period" DESC);

    -- AsinCache: Index for expires_at cleanup jobs
    -- Covers: WHERE expires_at < NOW() (for cache cleanup)
    CREATE INDEX IF NOT EXISTS "idx_asin_cache_expires"
    ON "ranksheet"."asin_cache"("expires_at")
    WHERE "expires_at" IS NOT NULL;

    -- AsinCache: Index for status filtering
    -- Covers: WHERE status = 'VALID'
    CREATE INDEX IF NOT EXISTS "idx_asin_cache_status"
    ON "ranksheet"."asin_cache"("status");
  `,
  })
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.execute({
    sql: sql`
    DROP INDEX IF EXISTS "ranksheet"."idx_asin_cache_status";
    DROP INDEX IF EXISTS "ranksheet"."idx_asin_cache_expires";
    DROP INDEX IF EXISTS "ranksheet"."idx_rank_sheets_period";
    DROP INDEX IF EXISTS "ranksheet"."idx_rank_sheets_keyword_period";
    DROP INDEX IF EXISTS "ranksheet"."idx_keywords_status_category";
    DROP INDEX IF EXISTS "ranksheet"."idx_keywords_active_priority";
  `,
  })
}
