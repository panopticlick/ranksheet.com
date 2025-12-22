import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.execute({ sql: sql`
	 CREATE TYPE "ranksheet"."enum_keyword_requests_category" AS ENUM('electronics', 'home', 'sports', 'health', 'toys', 'automotive', 'office', 'other');
	CREATE TYPE "ranksheet"."enum_keyword_requests_status" AS ENUM('NEW', 'REVIEWED', 'APPROVED', 'REJECTED');
	CREATE TABLE "ranksheet"."keyword_requests" (
		"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"keyword" varchar NOT NULL,
  	"category" "ranksheet"."enum_keyword_requests_category",
  	"email" varchar,
  	"note" varchar,
  	"status" "ranksheet"."enum_keyword_requests_status" DEFAULT 'NEW',
  	"votes" numeric DEFAULT 0,
  	"last_voted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "ranksheet"."payload_locked_documents_rels" ADD COLUMN "keyword_requests_id" integer;
  CREATE UNIQUE INDEX "keyword_requests_slug_idx" ON "ranksheet"."keyword_requests" USING btree ("slug");
	CREATE INDEX "keyword_requests_updated_at_idx" ON "ranksheet"."keyword_requests" USING btree ("updated_at");
	CREATE INDEX "keyword_requests_created_at_idx" ON "ranksheet"."keyword_requests" USING btree ("created_at");
	ALTER TABLE "ranksheet"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_keyword_requests_fk" FOREIGN KEY ("keyword_requests_id") REFERENCES "ranksheet"."keyword_requests"("id") ON DELETE cascade ON UPDATE no action;
	CREATE INDEX "payload_locked_documents_rels_keyword_requests_id_idx" ON "ranksheet"."payload_locked_documents_rels" USING btree ("keyword_requests_id");` })
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.execute({ sql: sql`
	 ALTER TABLE "ranksheet"."keyword_requests" DISABLE ROW LEVEL SECURITY;
	DROP TABLE "ranksheet"."keyword_requests" CASCADE;
	ALTER TABLE "ranksheet"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_keyword_requests_fk";
	
	DROP INDEX "ranksheet"."payload_locked_documents_rels_keyword_requests_id_idx";
	ALTER TABLE "ranksheet"."payload_locked_documents_rels" DROP COLUMN "keyword_requests_id";
	DROP TYPE "ranksheet"."enum_keyword_requests_category";
	DROP TYPE "ranksheet"."enum_keyword_requests_status";` })
}
