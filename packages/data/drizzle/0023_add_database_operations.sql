-- Create the gated database operations tables.
--
-- This migration is the framework's bootstrap and is never itself gated. It
-- precedes every migration that declares a required operation, so by the time
-- the runner has a gate to evaluate the tables it reads exist. A gate declared
-- against this migration or an earlier one would be unsatisfiable.
CREATE TABLE "database_operation_findings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "database_operation_findings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"operation_id" integer NOT NULL,
	"code" text NOT NULL,
	"subject" text,
	"detail" jsonb,
	"created_at" timestamp DEFAULT timezone('utc', now()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "database_operations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "database_operations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
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
	CONSTRAINT "database_operations_key_version_key" UNIQUE("key","version"),
	CONSTRAINT "database_operations_kind_valid" CHECK (kind in ('audit', 'data_migration')),
	CONSTRAINT "database_operations_status_valid" CHECK (status in ('running', 'passed', 'failed', 'errored'))
);
--> statement-breakpoint
ALTER TABLE "database_operation_findings" ADD CONSTRAINT "database_operation_findings_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "public"."database_operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_database_operation_findings_operation_id" ON "database_operation_findings" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "idx_database_operations_key" ON "database_operations" USING btree ("key");