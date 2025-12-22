import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.execute({ sql: sql`
    -- Composite index for search WHERE clause filtering
    -- Covers: is_active = true AND indexable = true AND status = 'ACTIVE'
    CREATE INDEX IF NOT EXISTS "idx_keywords_search_filters"
    ON "ranksheet"."keywords"("is_active", "indexable", "status")
    WHERE "is_active" = true AND "indexable" = true AND "status" = 'ACTIVE';

    -- Category filter index
    CREATE INDEX IF NOT EXISTS "idx_keywords_category"
    ON "ranksheet"."keywords"("category");

    -- Sorting index for priority and last_refreshed_at
    CREATE INDEX IF NOT EXISTS "idx_keywords_sort_priority_refreshed"
    ON "ranksheet"."keywords"("priority" DESC NULLS LAST, "last_refreshed_at" DESC NULLS LAST);

    -- Text pattern indexes for ILIKE prefix matching (keyword ILIKE 'term%')
    -- Using text_pattern_ops for efficient prefix searches
    CREATE INDEX IF NOT EXISTS "idx_keywords_keyword_pattern"
    ON "ranksheet"."keywords"("keyword" text_pattern_ops);

    CREATE INDEX IF NOT EXISTS "idx_keywords_slug_pattern"
    ON "ranksheet"."keywords"("slug" text_pattern_ops);

    -- Composite index for slug lookups (used in /api/public/sheets/[slug])
    CREATE INDEX IF NOT EXISTS "idx_keywords_slug_lookup"
    ON "ranksheet"."keywords"("slug")
    WHERE "is_active" = true;
  ` })
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.execute({ sql: sql`
    DROP INDEX IF EXISTS "ranksheet"."idx_keywords_slug_lookup";
    DROP INDEX IF EXISTS "ranksheet"."idx_keywords_slug_pattern";
    DROP INDEX IF EXISTS "ranksheet"."idx_keywords_keyword_pattern";
    DROP INDEX IF EXISTS "ranksheet"."idx_keywords_sort_priority_refreshed";
    DROP INDEX IF EXISTS "ranksheet"."idx_keywords_category";
    DROP INDEX IF EXISTS "ranksheet"."idx_keywords_search_filters";
  ` })
}
