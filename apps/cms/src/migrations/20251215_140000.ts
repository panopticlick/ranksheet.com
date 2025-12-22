import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.execute({ sql: sql`
    -- Add ASIN cache table for reducing Express API calls
    CREATE TABLE IF NOT EXISTS "ranksheet"."asin_cache" (
      "asin" VARCHAR(20) PRIMARY KEY,
      "title" TEXT,
      "brand" TEXT,
      "image_url" TEXT,
      "parent_asin" VARCHAR(20),
      "price_cents" INTEGER,
      "price_currency" VARCHAR(3) DEFAULT 'USD',
      "source" VARCHAR(50) DEFAULT 'express',
      "fetched_at" TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW(),
      "expires_at" TIMESTAMP(3) WITH TIME ZONE,
      "created_at" TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW(),
      "updated_at" TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW()
    );

    -- Index for parent_asin lookups (variation grouping)
    CREATE INDEX IF NOT EXISTS "idx_asin_cache_parent" ON "ranksheet"."asin_cache"("parent_asin");

    -- Index for expiration cleanup queries
    CREATE INDEX IF NOT EXISTS "idx_asin_cache_expires" ON "ranksheet"."asin_cache"("expires_at");

    -- Add job_runs table for tracking refresh jobs
    CREATE TABLE IF NOT EXISTS "ranksheet"."job_runs" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "job_name" VARCHAR(80) NOT NULL,
      "keyword_slug" VARCHAR(255),
      "status" VARCHAR(20) NOT NULL,
      "queued_at" TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW(),
      "started_at" TIMESTAMP(3) WITH TIME ZONE,
      "finished_at" TIMESTAMP(3) WITH TIME ZONE,
      "duration_ms" INTEGER,
      "detail" JSONB
    );

    -- Index for job queries
    CREATE INDEX IF NOT EXISTS "idx_job_runs_name" ON "ranksheet"."job_runs"("job_name", "queued_at" DESC);
    CREATE INDEX IF NOT EXISTS "idx_job_runs_slug" ON "ranksheet"."job_runs"("keyword_slug", "queued_at" DESC);
  ` })
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.execute({ sql: sql`
    DROP INDEX IF EXISTS "ranksheet"."idx_job_runs_slug";
    DROP INDEX IF EXISTS "ranksheet"."idx_job_runs_name";
    DROP TABLE IF EXISTS "ranksheet"."job_runs";

    DROP INDEX IF EXISTS "ranksheet"."idx_asin_cache_expires";
    DROP INDEX IF EXISTS "ranksheet"."idx_asin_cache_parent";
    DROP TABLE IF EXISTS "ranksheet"."asin_cache";
  ` })
}
