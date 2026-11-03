CREATE TABLE "instrument_groups" (
	"instrument_id" integer NOT NULL,
	"group_id" integer NOT NULL,
	CONSTRAINT "instrument_groups_pkey" PRIMARY KEY("instrument_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "instruments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "instruments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp NOT NULL,
	"model" text,
	"name" text NOT NULL,
	"serial" text NOT NULL,
	CONSTRAINT "instruments_serial_key" UNIQUE("serial")
);
--> statement-breakpoint
CREATE TABLE "run_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "run_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"claimed_at" timestamp,
	"error" text,
	"index" text,
	"index2" text,
	"run_id" integer NOT NULL,
	"sample_id" bigint,
	"sample_name" text,
	"sample_project" text,
	"sheet_sample_id" text NOT NULL,
	CONSTRAINT "run_entries_run_id_sheet_sample_id_key" UNIQUE("run_id","sheet_sample_id")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"auto_create" boolean NOT NULL,
	"created_at" timestamp NOT NULL,
	"flowcell" text,
	"group_id" integer,
	"instrument_id" integer,
	"library_type" text NOT NULL,
	"name" text NOT NULL,
	"origin" text NOT NULL,
	"run_number" integer,
	"technician_id" integer,
	"updated_at" timestamp NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "runs_identity_key" UNIQUE("instrument_id","run_number","flowcell"),
	CONSTRAINT "ck_runs_identity_complete" CHECK (("runs"."instrument_id" is null) = ("runs"."run_number" is null) and ("runs"."run_number" is null) = ("runs"."flowcell" is null)),
	CONSTRAINT "ck_runs_detected_identity" CHECK ("runs"."origin" <> 'detected' or "runs"."instrument_id" is not null),
	CONSTRAINT "ck_runs_origin" CHECK ("runs"."origin" in ('declared', 'detected')),
	CONSTRAINT "ck_runs_library_type" CHECK ("runs"."library_type" in ('amplicon', 'normal', 'other', 'srna'))
);
--> statement-breakpoint
ALTER TABLE "legacy_samples" ADD COLUMN "run_id" integer;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "header_flowcell" text;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "header_instrument" text;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "header_lane" integer;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "header_read_side" smallint;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "header_run_number" integer;--> statement-breakpoint
ALTER TABLE "instrument_groups" ADD CONSTRAINT "instrument_groups_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instrument_groups" ADD CONSTRAINT "instrument_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_entries" ADD CONSTRAINT "run_entries_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_entries" ADD CONSTRAINT "run_entries_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "public"."legacy_samples"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_runs_group_id" ON "runs" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "ix_runs_technician_id" ON "runs" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "ix_runs_user_id" ON "runs" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "legacy_samples" ADD CONSTRAINT "legacy_samples_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_legacy_samples_run_id" ON "legacy_samples" USING btree ("run_id");--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "ck_uploads_header_complete" CHECK (("uploads"."header_instrument" is null) = ("uploads"."header_run_number" is null) and ("uploads"."header_run_number" is null) = ("uploads"."header_flowcell" is null) and ("uploads"."header_flowcell" is null) = ("uploads"."header_lane" is null));--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "ck_uploads_header_read_side" CHECK (("uploads"."header_read_side" is null) or ("uploads"."header_read_side" in (1, 2) and "uploads"."header_instrument" is not null));