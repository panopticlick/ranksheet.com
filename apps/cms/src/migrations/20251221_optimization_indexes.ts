import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

/**
 * Migration: Optimization Indexes
 * Created: 2025-12-21
 * Purpose: Add performance indexes to keywords and rank_sheets tables
 *
 * This migration adds:
 * 1. Compound indexes for keywords collection (category, status, priority queries)
 * 2. Compound indexes for rank_sheets collection (keyword + dataPeriod)
 * 3. GIN index for JSONB rows column (optional ASIN lookups)
 * 4. Partial index for recent data (6 months optimization)
 */

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const { db } = payload

  // ==================== Keywords Table Indexes ====================

  // Index 1: Category + Status + Active (for API filtering)
  await db.execute({
    sql: sql`
      CREATE INDEX IF NOT EXISTS idx_keywords_category_status_active
      ON ranksheet.keywords (category, status, is_active)
      WHERE category IS NOT NULL AND status IS NOT NULL;
    `,
  })

  // Index 2: Priority + LastRefreshedAt (for refresh queue ordering)
  await db.execute({
    sql: sql`
      CREATE INDEX IF NOT EXISTS idx_keywords_priority_refresh
      ON ranksheet.keywords (priority DESC, last_refreshed_at ASC NULLS FIRST);
    `,
  })

  // Index 3: Indexable + Status + Active (for sitemap generation)
  await db.execute({
    sql: sql`
      CREATE INDEX IF NOT EXISTS idx_keywords_indexable_status_active
      ON ranksheet.keywords (indexable, status, is_active)
      WHERE indexable = true;
    `,
  })

  // Index 4: Marketplace + Category + Indexable (for multi-market support)
  await db.execute({
    sql: sql`
      CREATE INDEX IF NOT EXISTS idx_keywords_marketplace_category_indexable
      ON ranksheet.keywords (marketplace, category, indexable)
      WHERE marketplace IS NOT NULL;
    `,
  })

  // ==================== RankSheets Table Indexes ====================

  // Index 5: Keyword + DataPeriod DESC (for latest sheet queries)
  await db.execute({
    sql: sql`
      CREATE INDEX IF NOT EXISTS idx_rank_sheets_keyword_period_desc
      ON ranksheet.rank_sheets (keyword_id, data_period DESC);
    `,
  })

  // Index 6: Unique constraint (prevent duplicate periods)
  await db.execute({
    sql: sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rank_sheets_keyword_period_unique
      ON ranksheet.rank_sheets (keyword_id, data_period);
    `,
  })

  // Index 7: Partial index for recent 6 months (space optimization)
  await db.execute({
    sql: sql`
      CREATE INDEX IF NOT EXISTS idx_rank_sheets_recent
      ON ranksheet.rank_sheets (keyword_id, data_period DESC)
      WHERE data_period >= (CURRENT_DATE - INTERVAL '6 months')::TEXT;
    `,
  })

  // Index 8: GIN index on JSONB rows column (for ASIN lookups)
  await db.execute({
    sql: sql`
      CREATE INDEX IF NOT EXISTS idx_rank_sheets_rows_gin
      ON ranksheet.rank_sheets USING GIN (rows jsonb_path_ops);
    `,
  })

  // Index 9: DataPeriod only (for global latest period queries)
  await db.execute({
    sql: sql`
      CREATE INDEX IF NOT EXISTS idx_rank_sheets_data_period
      ON ranksheet.rank_sheets (data_period DESC);
    `,
  })

  // ==================== AsinCache Table Status Column ====================

  // Add status column for negative caching (if not exists)
  await db.execute({
    sql: sql`
      ALTER TABLE ranksheet.asin_cache
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'EXISTS'
      CHECK (status IN ('EXISTS', 'NOT_FOUND'));
    `,
  })

  // Index for status-based queries
  await db.execute({
    sql: sql`
      CREATE INDEX IF NOT EXISTS idx_asin_cache_status_expires
      ON ranksheet.asin_cache (status, expires_at)
      WHERE expires_at > NOW();
    `,
  })

  console.log('✅ Created optimization indexes on keywords, rank_sheets, and asin_cache tables')
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  const { db } = payload

  // Drop keywords indexes
  await db.execute({
    sql: sql`
      DROP INDEX IF EXISTS ranksheet.idx_keywords_category_status_active;
      DROP INDEX IF EXISTS ranksheet.idx_keywords_priority_refresh;
      DROP INDEX IF EXISTS ranksheet.idx_keywords_indexable_status_active;
      DROP INDEX IF EXISTS ranksheet.idx_keywords_marketplace_category_indexable;
    `,
  })

  // Drop rank_sheets indexes
  await db.execute({
    sql: sql`
      DROP INDEX IF EXISTS ranksheet.idx_rank_sheets_keyword_period_desc;
      DROP INDEX IF EXISTS ranksheet.idx_rank_sheets_keyword_period_unique;
      DROP INDEX IF EXISTS ranksheet.idx_rank_sheets_recent;
      DROP INDEX IF EXISTS ranksheet.idx_rank_sheets_rows_gin;
      DROP INDEX IF EXISTS ranksheet.idx_rank_sheets_data_period;
    `,
  })

  // Drop asin_cache indexes and column
  await db.execute({
    sql: sql`
      DROP INDEX IF EXISTS ranksheet.idx_asin_cache_status_expires;
      ALTER TABLE ranksheet.asin_cache DROP COLUMN IF EXISTS status;
    `,
  })

  console.log('✅ Dropped optimization indexes from keywords, rank_sheets, and asin_cache tables')
}
