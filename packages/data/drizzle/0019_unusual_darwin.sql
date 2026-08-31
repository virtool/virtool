CREATE TABLE "otu_changes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "otu_changes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"reference_id" uuid NOT NULL,
	"otu_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"command" text NOT NULL,
	"command_schema_version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"source" text NOT NULL,
	"user_id" integer,
	"remote_event_id" text,
	"remote_author" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "otu_changes_otu_id_version_key" UNIQUE("otu_id","version"),
	CONSTRAINT "otu_changes_command_schema_version_check" CHECK ("otu_changes"."command_schema_version" >= 1),
	CONSTRAINT "otu_changes_source_check" CHECK ("otu_changes"."source" in ('user', 'system', 'remote', 'copy'))
);
--> statement-breakpoint
CREATE TABLE "otu_isolate_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"otu_id" uuid NOT NULL,
	"isolate_id" uuid NOT NULL,
	"name_type" text,
	"name_value" text,
	"first_version" integer NOT NULL,
	"last_version" integer,
	CONSTRAINT "otu_isolate_versions_name_check" CHECK (("otu_isolate_versions"."name_type" is null and "otu_isolate_versions"."name_value" is null) or ("otu_isolate_versions"."name_type" is not null and btrim("otu_isolate_versions"."name_value") <> '')),
	CONSTRAINT "otu_isolate_versions_version_range_check" CHECK ("otu_isolate_versions"."first_version" >= 1 and ("otu_isolate_versions"."last_version" is null or "otu_isolate_versions"."last_version" > "otu_isolate_versions"."first_version"))
);
--> statement-breakpoint
CREATE TABLE "otu_isolates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"otu_id" uuid NOT NULL,
	CONSTRAINT "otu_isolates_otu_id_id_key" UNIQUE("otu_id","id")
);
--> statement-breakpoint
CREATE TABLE "otu_local_identities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference_id" uuid NOT NULL,
	"otu_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "otu_local_identities_reference_id_otu_id_key" UNIQUE("reference_id","otu_id"),
	CONSTRAINT "otu_local_identities_reference_id_otu_id_id_key" UNIQUE("reference_id","otu_id","id")
);
--> statement-breakpoint
CREATE TABLE "otu_local_identity_revisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference_id" uuid NOT NULL,
	"otu_id" uuid NOT NULL,
	"identity_id" uuid NOT NULL,
	"name" text NOT NULL,
	"acronym" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "otu_local_identity_revisions_reference_otu_id_key" UNIQUE("reference_id","otu_id","id"),
	CONSTRAINT "otu_local_identity_revisions_name_check" CHECK (btrim("otu_local_identity_revisions"."name") <> ''),
	CONSTRAINT "otu_local_identity_revisions_acronym_check" CHECK ("otu_local_identity_revisions"."acronym" is null or btrim("otu_local_identity_revisions"."acronym") <> '')
);
--> statement-breakpoint
CREATE TABLE "otu_local_sequence_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"otu_id" uuid NOT NULL,
	"sequence_id" uuid NOT NULL,
	"definition" text NOT NULL,
	"sequence" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "otu_local_sequence_records_otu_sequence_id_key" UNIQUE("otu_id","sequence_id","id"),
	CONSTRAINT "otu_local_sequence_records_definition_check" CHECK (btrim("otu_local_sequence_records"."definition") <> ''),
	CONSTRAINT "otu_local_sequence_records_sequence_check" CHECK ("otu_local_sequence_records"."sequence" <> '' and "otu_local_sequence_records"."sequence" ~ '^[ATCGNRYKMSWBDHV]+$')
);
--> statement-breakpoint
CREATE TABLE "otu_plan_segment_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"otu_id" uuid NOT NULL,
	"segment_id" uuid NOT NULL,
	"name_prefix" text,
	"name_key" text,
	"length" integer NOT NULL,
	"length_tolerance" double precision NOT NULL,
	"rule" text NOT NULL,
	"first_version" integer NOT NULL,
	"last_version" integer,
	CONSTRAINT "otu_plan_segment_versions_length_check" CHECK ("otu_plan_segment_versions"."length" > 0),
	CONSTRAINT "otu_plan_segment_versions_tolerance_check" CHECK ("otu_plan_segment_versions"."length_tolerance" between 0 and 1),
	CONSTRAINT "otu_plan_segment_versions_name_check" CHECK (("otu_plan_segment_versions"."name_prefix" is null and "otu_plan_segment_versions"."name_key" is null) or ("otu_plan_segment_versions"."name_prefix" is not null and "otu_plan_segment_versions"."name_key" is not null)),
	CONSTRAINT "otu_plan_segment_versions_rule_check" CHECK ("otu_plan_segment_versions"."rule" in ('required', 'recommended', 'optional')),
	CONSTRAINT "otu_plan_segment_versions_version_range_check" CHECK ("otu_plan_segment_versions"."first_version" >= 1 and ("otu_plan_segment_versions"."last_version" is null or "otu_plan_segment_versions"."last_version" > "otu_plan_segment_versions"."first_version"))
);
--> statement-breakpoint
CREATE TABLE "otu_plan_segments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"otu_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	CONSTRAINT "otu_plan_segments_otu_id_id_key" UNIQUE("otu_id","id")
);
--> statement-breakpoint
CREATE TABLE "otu_plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"otu_id" uuid NOT NULL,
	CONSTRAINT "otu_plans_otu_id_key" UNIQUE("otu_id"),
	CONSTRAINT "otu_plans_otu_id_id_key" UNIQUE("otu_id","id")
);
--> statement-breakpoint
CREATE TABLE "otu_sequence_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"otu_id" uuid NOT NULL,
	"sequence_id" uuid NOT NULL,
	"isolate_id" uuid NOT NULL,
	"segment_id" uuid NOT NULL,
	"local_record_id" uuid NOT NULL,
	"first_version" integer NOT NULL,
	"last_version" integer,
	CONSTRAINT "otu_sequence_versions_version_range_check" CHECK ("otu_sequence_versions"."first_version" >= 1 and ("otu_sequence_versions"."last_version" is null or "otu_sequence_versions"."last_version" > "otu_sequence_versions"."first_version"))
);
--> statement-breakpoint
CREATE TABLE "otu_sequences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"otu_id" uuid NOT NULL,
	CONSTRAINT "otu_sequences_otu_id_id_key" UNIQUE("otu_id","id")
);
--> statement-breakpoint
CREATE TABLE "otu_taxonomy_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference_id" uuid NOT NULL,
	"otu_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"local_identity_revision_id" uuid,
	"lineage_id" uuid,
	"first_version" integer NOT NULL,
	"last_version" integer,
	CONSTRAINT "otu_taxonomy_versions_shape_check" CHECK (("otu_taxonomy_versions"."kind" = 'local' and "otu_taxonomy_versions"."local_identity_revision_id" is not null and "otu_taxonomy_versions"."lineage_id" is null) or ("otu_taxonomy_versions"."kind" = 'ncbi' and "otu_taxonomy_versions"."local_identity_revision_id" is null and "otu_taxonomy_versions"."lineage_id" is not null)),
	CONSTRAINT "otu_taxonomy_versions_version_range_check" CHECK ("otu_taxonomy_versions"."first_version" >= 1 and ("otu_taxonomy_versions"."last_version" is null or "otu_taxonomy_versions"."last_version" > "otu_taxonomy_versions"."first_version"))
);
--> statement-breakpoint
CREATE TABLE "otus" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference_id" uuid NOT NULL,
	"remote_id" uuid,
	"molecule_type" text NOT NULL,
	"molecule_strandedness" text NOT NULL,
	"molecule_topology" text NOT NULL,
	"version" integer NOT NULL,
	"ncbi_from_version" integer,
	"deleted_version" integer,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "otus_reference_id_id_key" UNIQUE("reference_id","id"),
	CONSTRAINT "otus_version_check" CHECK ("otus"."version" >= 1),
	CONSTRAINT "otus_molecule_type_check" CHECK ("otus"."molecule_type" in ('cRNA', 'DNA', 'mRNA', 'RNA', 'tRNA')),
	CONSTRAINT "otus_molecule_strandedness_check" CHECK ("otus"."molecule_strandedness" in ('single', 'double')),
	CONSTRAINT "otus_molecule_topology_check" CHECK ("otus"."molecule_topology" in ('linear', 'circular')),
	CONSTRAINT "otus_ncbi_from_version_check" CHECK ("otus"."ncbi_from_version" is null or "otus"."ncbi_from_version" between 1 and "otus"."version"),
	CONSTRAINT "otus_deleted_version_check" CHECK ("otus"."deleted_version" is null or "otus"."deleted_version" = "otus"."version")
);
--> statement-breakpoint
CREATE TABLE "reference_groups" (
	"reference_id" uuid NOT NULL,
	"group_id" integer NOT NULL,
	"build" boolean NOT NULL,
	"modify" boolean NOT NULL,
	"modify_otu" boolean NOT NULL,
	CONSTRAINT "reference_groups_pkey" PRIMARY KEY("reference_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "reference_roots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"kind" text NOT NULL,
	"remote_url" text,
	"remote_cursor" text,
	"default_segment_length_tolerance" double precision NOT NULL,
	"archived" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reference_roots_kind_check" CHECK ("reference_roots"."kind" in ('local', 'remote')),
	CONSTRAINT "reference_roots_remote_shape_check" CHECK (("reference_roots"."kind" = 'local' and "reference_roots"."remote_url" is null and "reference_roots"."remote_cursor" is null) or ("reference_roots"."kind" = 'remote' and "reference_roots"."remote_url" is not null)),
	CONSTRAINT "reference_roots_default_tolerance_check" CHECK ("reference_roots"."default_segment_length_tolerance" between 0 and 1)
);
--> statement-breakpoint
CREATE TABLE "reference_users" (
	"reference_id" uuid NOT NULL,
	"user_id" integer NOT NULL,
	"build" boolean NOT NULL,
	"modify" boolean NOT NULL,
	"modify_otu" boolean NOT NULL,
	CONSTRAINT "reference_users_pkey" PRIMARY KEY("reference_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "otu_changes" ADD CONSTRAINT "otu_changes_reference_id_otu_id_fkey" FOREIGN KEY ("reference_id","otu_id") REFERENCES "public"."otus"("reference_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otu_changes" ADD CONSTRAINT "otu_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otu_isolate_versions" ADD CONSTRAINT "otu_isolate_versions_otu_id_isolate_id_fkey" FOREIGN KEY ("otu_id","isolate_id") REFERENCES "public"."otu_isolates"("otu_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otu_isolates" ADD CONSTRAINT "otu_isolates_otu_id_fkey" FOREIGN KEY ("otu_id") REFERENCES "public"."otus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otu_local_identities" ADD CONSTRAINT "otu_local_identities_reference_id_otu_id_fkey" FOREIGN KEY ("reference_id","otu_id") REFERENCES "public"."otus"("reference_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otu_local_identity_revisions" ADD CONSTRAINT "otu_local_identity_revisions_reference_id_otu_id_identity_id_fkey" FOREIGN KEY ("reference_id","otu_id","identity_id") REFERENCES "public"."otu_local_identities"("reference_id","otu_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otu_local_sequence_records" ADD CONSTRAINT "otu_local_sequence_records_otu_id_sequence_id_fkey" FOREIGN KEY ("otu_id","sequence_id") REFERENCES "public"."otu_sequences"("otu_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otu_plan_segment_versions" ADD CONSTRAINT "otu_plan_segment_versions_otu_id_segment_id_fkey" FOREIGN KEY ("otu_id","segment_id") REFERENCES "public"."otu_plan_segments"("otu_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otu_plan_segments" ADD CONSTRAINT "otu_plan_segments_otu_id_plan_id_fkey" FOREIGN KEY ("otu_id","plan_id") REFERENCES "public"."otu_plans"("otu_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otu_plans" ADD CONSTRAINT "otu_plans_otu_id_fkey" FOREIGN KEY ("otu_id") REFERENCES "public"."otus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otu_sequence_versions" ADD CONSTRAINT "otu_sequence_versions_otu_id_sequence_id_fkey" FOREIGN KEY ("otu_id","sequence_id") REFERENCES "public"."otu_sequences"("otu_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otu_sequence_versions" ADD CONSTRAINT "otu_sequence_versions_otu_id_isolate_id_fkey" FOREIGN KEY ("otu_id","isolate_id") REFERENCES "public"."otu_isolates"("otu_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otu_sequence_versions" ADD CONSTRAINT "otu_sequence_versions_otu_id_segment_id_fkey" FOREIGN KEY ("otu_id","segment_id") REFERENCES "public"."otu_plan_segments"("otu_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otu_sequence_versions" ADD CONSTRAINT "otu_sequence_versions_otu_id_sequence_id_local_record_id_fkey" FOREIGN KEY ("otu_id","sequence_id","local_record_id") REFERENCES "public"."otu_local_sequence_records"("otu_id","sequence_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otu_sequences" ADD CONSTRAINT "otu_sequences_otu_id_fkey" FOREIGN KEY ("otu_id") REFERENCES "public"."otus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otu_taxonomy_versions" ADD CONSTRAINT "otu_taxonomy_versions_reference_id_otu_id_fkey" FOREIGN KEY ("reference_id","otu_id") REFERENCES "public"."otus"("reference_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otu_taxonomy_versions" ADD CONSTRAINT "otu_taxonomy_versions_reference_id_otu_id_local_identity_revision_id_fkey" FOREIGN KEY ("reference_id","otu_id","local_identity_revision_id") REFERENCES "public"."otu_local_identity_revisions"("reference_id","otu_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otus" ADD CONSTRAINT "otus_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "public"."reference_roots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_groups" ADD CONSTRAINT "reference_groups_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "public"."reference_roots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_groups" ADD CONSTRAINT "reference_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_users" ADD CONSTRAINT "reference_users_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "public"."reference_roots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_users" ADD CONSTRAINT "reference_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "otu_changes_reference_id_remote_event_id_key" ON "otu_changes" USING btree ("reference_id","remote_event_id") WHERE "otu_changes"."remote_event_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "otu_isolate_versions_current_key" ON "otu_isolate_versions" USING btree ("otu_id","isolate_id") WHERE "otu_isolate_versions"."last_version" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "otu_plan_segment_versions_current_key" ON "otu_plan_segment_versions" USING btree ("otu_id","segment_id") WHERE "otu_plan_segment_versions"."last_version" is null;--> statement-breakpoint
CREATE INDEX "otu_plan_segment_versions_otu_id_idx" ON "otu_plan_segment_versions" USING btree ("otu_id");--> statement-breakpoint
CREATE UNIQUE INDEX "otu_sequence_versions_current_key" ON "otu_sequence_versions" USING btree ("otu_id","sequence_id") WHERE "otu_sequence_versions"."last_version" is null;--> statement-breakpoint
CREATE INDEX "otu_sequence_versions_otu_isolate_idx" ON "otu_sequence_versions" USING btree ("otu_id","isolate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "otu_taxonomy_versions_current_key" ON "otu_taxonomy_versions" USING btree ("otu_id") WHERE "otu_taxonomy_versions"."last_version" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "otus_reference_id_remote_id_key" ON "otus" USING btree ("reference_id","remote_id") WHERE "otus"."remote_id" is not null;
--> statement-breakpoint
ALTER TABLE "otus" ADD CONSTRAINT "otus_current_change_fkey" FOREIGN KEY ("id","version") REFERENCES "otu_changes"("otu_id","version") DEFERRABLE INITIALLY DEFERRED;
