import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.execute({ sql: sql`
	 CREATE TYPE "ranksheet"."enum_keywords_category" AS ENUM('electronics', 'home', 'sports', 'health', 'toys', 'automotive', 'office', 'other');
	CREATE TYPE "ranksheet"."enum_keywords_marketplace" AS ENUM('US', 'UK', 'DE');
	CREATE TYPE "ranksheet"."enum_keywords_status" AS ENUM('PENDING', 'WARMING_UP', 'ACTIVE', 'PAUSED', 'ERROR');
	CREATE TYPE "ranksheet"."enum_rank_sheets_mode" AS ENUM('NORMAL', 'LOW_DATA');
  CREATE TYPE "ranksheet"."enum_rank_sheets_readiness_level" AS ENUM('FULL', 'PARTIAL', 'LOW', 'CRITICAL');
  CREATE TABLE "ranksheet"."users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "ranksheet"."users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "ranksheet"."keywords" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"keyword" varchar NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"category" "ranksheet"."enum_keywords_category",
  	"marketplace" "ranksheet"."enum_keywords_marketplace" DEFAULT 'US',
  	"top_n" numeric DEFAULT 20,
  	"is_active" boolean DEFAULT true,
  	"status" "ranksheet"."enum_keywords_status" DEFAULT 'PENDING',
  	"status_reason" varchar,
  	"indexable" boolean DEFAULT true,
  	"priority" numeric DEFAULT 0,
  	"last_refreshed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ranksheet"."rank_sheets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"keyword_id" integer NOT NULL,
  	"data_period" varchar NOT NULL,
  	"report_date" timestamp(3) with time zone,
  	"mode" "ranksheet"."enum_rank_sheets_mode" DEFAULT 'NORMAL',
  	"valid_count" numeric DEFAULT 0,
  	"readiness_level" "ranksheet"."enum_rank_sheets_readiness_level" DEFAULT 'FULL',
  	"rows" jsonb NOT NULL,
  	"history" jsonb,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ranksheet"."payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "ranksheet"."payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ranksheet"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"keywords_id" integer,
  	"rank_sheets_id" integer
  );
  
  CREATE TABLE "ranksheet"."payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ranksheet"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "ranksheet"."payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "ranksheet"."users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "ranksheet"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ranksheet"."rank_sheets" ADD CONSTRAINT "rank_sheets_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "ranksheet"."keywords"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ranksheet"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "ranksheet"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ranksheet"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "ranksheet"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ranksheet"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_keywords_fk" FOREIGN KEY ("keywords_id") REFERENCES "ranksheet"."keywords"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ranksheet"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rank_sheets_fk" FOREIGN KEY ("rank_sheets_id") REFERENCES "ranksheet"."rank_sheets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ranksheet"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "ranksheet"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ranksheet"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "ranksheet"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "ranksheet"."users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "ranksheet"."users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "ranksheet"."users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "ranksheet"."users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "ranksheet"."users" USING btree ("email");
  CREATE UNIQUE INDEX "keywords_slug_idx" ON "ranksheet"."keywords" USING btree ("slug");
  CREATE UNIQUE INDEX "keywords_keyword_idx" ON "ranksheet"."keywords" USING btree ("keyword");
  CREATE INDEX "keywords_updated_at_idx" ON "ranksheet"."keywords" USING btree ("updated_at");
  CREATE INDEX "keywords_created_at_idx" ON "ranksheet"."keywords" USING btree ("created_at");
  CREATE INDEX "rank_sheets_keyword_idx" ON "ranksheet"."rank_sheets" USING btree ("keyword_id");
  CREATE INDEX "rank_sheets_updated_at_idx" ON "ranksheet"."rank_sheets" USING btree ("updated_at");
  CREATE INDEX "rank_sheets_created_at_idx" ON "ranksheet"."rank_sheets" USING btree ("created_at");
  CREATE UNIQUE INDEX "keyword_dataPeriod_idx" ON "ranksheet"."rank_sheets" USING btree ("keyword_id","data_period");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "ranksheet"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "ranksheet"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "ranksheet"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "ranksheet"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "ranksheet"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "ranksheet"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "ranksheet"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "ranksheet"."payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_keywords_id_idx" ON "ranksheet"."payload_locked_documents_rels" USING btree ("keywords_id");
  CREATE INDEX "payload_locked_documents_rels_rank_sheets_id_idx" ON "ranksheet"."payload_locked_documents_rels" USING btree ("rank_sheets_id");
  CREATE INDEX "payload_preferences_key_idx" ON "ranksheet"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "ranksheet"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "ranksheet"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "ranksheet"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "ranksheet"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "ranksheet"."payload_preferences_rels" USING btree ("path");
	  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "ranksheet"."payload_preferences_rels" USING btree ("users_id");
	  CREATE INDEX "payload_migrations_updated_at_idx" ON "ranksheet"."payload_migrations" USING btree ("updated_at");
	  CREATE INDEX "payload_migrations_created_at_idx" ON "ranksheet"."payload_migrations" USING btree ("created_at");` })
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.execute({ sql: sql`
	 DROP TABLE "ranksheet"."users_sessions" CASCADE;
	DROP TABLE "ranksheet"."users" CASCADE;
	DROP TABLE "ranksheet"."keywords" CASCADE;
  DROP TABLE "ranksheet"."rank_sheets" CASCADE;
  DROP TABLE "ranksheet"."payload_kv" CASCADE;
  DROP TABLE "ranksheet"."payload_locked_documents" CASCADE;
  DROP TABLE "ranksheet"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "ranksheet"."payload_preferences" CASCADE;
  DROP TABLE "ranksheet"."payload_preferences_rels" CASCADE;
  DROP TABLE "ranksheet"."payload_migrations" CASCADE;
  DROP TYPE "ranksheet"."enum_keywords_category";
  DROP TYPE "ranksheet"."enum_keywords_marketplace";
	DROP TYPE "ranksheet"."enum_keywords_status";
	DROP TYPE "ranksheet"."enum_rank_sheets_mode";
	DROP TYPE "ranksheet"."enum_rank_sheets_readiness_level";` })
}
