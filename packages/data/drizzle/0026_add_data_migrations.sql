-- Bootstrap for data migrations; this file is never paired with a body.
CREATE TABLE "data_migration_findings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "data_migration_findings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"migration_id" integer NOT NULL,
	"code" text NOT NULL,
	"subject" text,
	"detail" jsonb,
	"created_at" timestamp DEFAULT timezone('utc', now()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_migrations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "data_migrations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"version" integer NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"progress" jsonb,
	"summary" jsonb,
	"error" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT timezone('utc', now()) NOT NULL,
	"updated_at" timestamp DEFAULT timezone('utc', now()) NOT NULL,
	CONSTRAINT "data_migrations_key_version_key" UNIQUE("key","version"),
	CONSTRAINT "data_migrations_kind_valid" CHECK (kind in ('audit', 'backfill')),
	CONSTRAINT "data_migrations_status_valid" CHECK (status in ('running', 'passed', 'failed', 'errored'))
);
--> statement-breakpoint
ALTER TABLE "data_migration_findings" ADD CONSTRAINT "data_migration_findings_migration_id_fkey" FOREIGN KEY ("migration_id") REFERENCES "public"."data_migrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_data_migration_findings_migration_id" ON "data_migration_findings" USING btree ("migration_id");--> statement-breakpoint
CREATE INDEX "idx_data_migrations_key" ON "data_migrations" USING btree ("key");