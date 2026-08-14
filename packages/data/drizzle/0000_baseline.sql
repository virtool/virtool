CREATE TYPE "public"."analysisformat" AS ENUM('sam', 'bam', 'fasta', 'fastq', 'csv', 'tsv', 'json');--> statement-breakpoint
CREATE TYPE "public"."subtractiontype" AS ENUM('fasta', 'bowtie2');--> statement-breakpoint
CREATE TYPE "public"."action" AS ENUM('create', 'update', 'delete', 'modify', 'remove');--> statement-breakpoint
CREATE TYPE "public"."resourcetype" AS ENUM('app', 'group');--> statement-breakpoint
CREATE TABLE "analyses" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "analyses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"legacy_id" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"workflow" text NOT NULL,
	"ready" boolean NOT NULL,
	"results" jsonb,
	"sample" text NOT NULL,
	"sample_id" bigint,
	"reference" text,
	"reference_id" bigint,
	"index" text,
	"index_id" bigint NOT NULL,
	"user_id" integer NOT NULL,
	"job_id" integer,
	CONSTRAINT "analyses_legacy_id_key" UNIQUE("legacy_id"),
	CONSTRAINT "ck_analyses_reference_present" CHECK (num_nonnulls("analyses"."reference", "analyses"."reference_id") >= 1)
);
--> statement-breakpoint
CREATE TABLE "analysis_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"analysis_id" bigint NOT NULL,
	"description" text,
	"format" "analysisformat",
	"name" text,
	"name_on_disk" text,
	"size" bigint,
	"storage_key" text,
	"uploaded_at" timestamp,
	CONSTRAINT "analysis_files_name_on_disk_key" UNIQUE("name_on_disk"),
	CONSTRAINT "uq_analysis_files_storage_key" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "analysis_subtractions" (
	"analysis_id" bigint NOT NULL,
	"subtraction_id" bigint NOT NULL,
	CONSTRAINT "analysis_subtractions_pkey" PRIMARY KEY("analysis_id","subtraction_id")
);
--> statement-breakpoint
CREATE TABLE "nuvs_blast" (
	"id" serial PRIMARY KEY NOT NULL,
	"analysis_id" bigint NOT NULL,
	"sequence_index" integer NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"last_checked_at" timestamp NOT NULL,
	"error" text,
	"interval" integer,
	"rid" varchar(24),
	"ready" boolean NOT NULL,
	"result" json,
	"task_id" integer,
	CONSTRAINT "nuvs_blast_analysis_id_sequence_index_key" UNIQUE("analysis_id","sequence_index")
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"hashed" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"user_id" integer NOT NULL,
	"permissions" jsonb NOT NULL,
	CONSTRAINT "api_keys_hashed_key" UNIQUE("hashed")
);
--> statement-breakpoint
CREATE TABLE "caches" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"storage_key" text NOT NULL,
	"params" jsonb NOT NULL,
	"size" bigint NOT NULL,
	"created_at" timestamp NOT NULL,
	"last_accessed_at" timestamp NOT NULL,
	CONSTRAINT "cache_key" UNIQUE("key"),
	CONSTRAINT "caches_storage_key_key" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_id" text,
	"name" varchar(255) NOT NULL,
	"permissions" jsonb NOT NULL,
	CONSTRAINT "groups_name_unique" UNIQUE("name"),
	CONSTRAINT "groups_legacy_id_key" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "user_groups" (
	"group_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"primary" boolean NOT NULL,
	CONSTRAINT "user_groups_pkey" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "legacy_history" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "legacy_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"legacy_id" text,
	"created_at" timestamp NOT NULL,
	"description" text NOT NULL,
	"method_name" text NOT NULL,
	"user_id" integer NOT NULL,
	"otu" text NOT NULL,
	"otu_name" text NOT NULL,
	"otu_version" text,
	"reference" text,
	"reference_id" bigint,
	"index" text,
	"index_id" bigint,
	CONSTRAINT "legacy_history_legacy_id_key" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "legacy_history_diff" (
	"id" serial NOT NULL,
	"change_id" text NOT NULL,
	"history_id" bigint,
	"diff" jsonb NOT NULL,
	CONSTRAINT "history_diffs_pkey" PRIMARY KEY("id"),
	CONSTRAINT "history_diffs_change_id_key" UNIQUE("change_id"),
	CONSTRAINT "legacy_history_diff_history_id_key" UNIQUE("history_id")
);
--> statement-breakpoint
CREATE TABLE "hmms" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "hmms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"legacy_id" text,
	"cluster" integer NOT NULL,
	"count" integer NOT NULL,
	"length" integer NOT NULL,
	"mean_entropy" double precision NOT NULL,
	"total_entropy" double precision NOT NULL,
	"hidden" boolean NOT NULL,
	"names" jsonb NOT NULL,
	"families" jsonb NOT NULL,
	"genera" jsonb NOT NULL,
	"entries" jsonb NOT NULL,
	CONSTRAINT "hmms_legacy_id_key" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "legacy_hmm_status" (
	"id" integer PRIMARY KEY NOT NULL,
	"errors" jsonb NOT NULL,
	"release" jsonb,
	"installed" jsonb,
	"task_id" integer,
	"updates" jsonb NOT NULL,
	CONSTRAINT "ck_legacy_hmm_status_singleton" CHECK ("legacy_hmm_status"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "index_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"index" text,
	"index_id" bigint NOT NULL,
	"type" text,
	"size" bigint,
	"storage_key" text NOT NULL,
	CONSTRAINT "uq_index_files_storage_key" UNIQUE("storage_key"),
	CONSTRAINT "index_files_index_id_name_key" UNIQUE("index_id","name"),
	CONSTRAINT "ck_index_files_type" CHECK ("index_files"."type" in ('json', 'fasta', 'bowtie2', 'sqlite'))
);
--> statement-breakpoint
CREATE TABLE "indexes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "indexes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"legacy_id" text,
	"version" integer NOT NULL,
	"created_at" timestamp NOT NULL,
	"manifest" jsonb NOT NULL,
	"ready" boolean NOT NULL,
	"storage_key" text NOT NULL,
	"otus_json_storage_key" text,
	"reference_id" bigint NOT NULL,
	"user_id" integer NOT NULL,
	"job_id" integer,
	"task_id" integer,
	CONSTRAINT "indexes_legacy_id_key" UNIQUE("legacy_id"),
	CONSTRAINT "indexes_storage_key_key" UNIQUE("storage_key"),
	CONSTRAINT "uq_indexes_otus_json_storage_key" UNIQUE("otus_json_storage_key"),
	CONSTRAINT "uq_indexes_reference_id_version" UNIQUE("reference_id","version"),
	CONSTRAINT "ck_indexes_job_or_task" CHECK (num_nonnulls("indexes"."job_id", "indexes"."task_id") <= 1)
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"acquired" boolean DEFAULT false NOT NULL,
	"claim" jsonb,
	"claimed_at" timestamp,
	"created_at" timestamp NOT NULL,
	"finished_at" timestamp,
	"key" text,
	"legacy_id" text,
	"pinged_at" timestamp,
	"state" text NOT NULL,
	"steps" jsonb,
	"user_id" integer NOT NULL,
	"workflow" text NOT NULL,
	CONSTRAINT "jobs_legacy_id_key" UNIQUE("legacy_id"),
	CONSTRAINT "ck_jobs_state" CHECK ("jobs"."state" in ('pending', 'running', 'cancelled', 'failed', 'succeeded'))
);
--> statement-breakpoint
CREATE TABLE "labels" (
	"id" serial PRIMARY KEY NOT NULL,
	"color" varchar(7),
	"description" text,
	"name" text,
	CONSTRAINT "labels_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "instance_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"active" boolean,
	"color" text NOT NULL,
	"message" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	"user" text,
	"user_id" integer,
	CONSTRAINT "ck_instance_messages_color" CHECK ("instance_messages"."color" in ('red', 'yellow', 'blue', 'purple', 'orange', 'grey'))
);
--> statement-breakpoint
CREATE TABLE "alembic_version" (
	"version_num" varchar(32) NOT NULL,
	CONSTRAINT "alembic_version_pkc" PRIMARY KEY("version_num")
);
--> statement-breakpoint
CREATE TABLE "revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"revision" text,
	"created_at" timestamp NOT NULL,
	"applied_at" timestamp NOT NULL,
	CONSTRAINT "revisions_revision_key" UNIQUE("revision")
);
--> statement-breakpoint
CREATE TABLE "legacy_otus" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text NOT NULL,
	"last_indexed_version" integer,
	"reference_id" bigint NOT NULL,
	"verified" boolean NOT NULL,
	"version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legacy_sequences" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"otu_id" text NOT NULL,
	"isolate_id" text NOT NULL,
	"segment" text,
	"position" bigint
);
--> statement-breakpoint
CREATE TABLE "legacy_reference_groups" (
	"reference_id" bigint NOT NULL,
	"group_id" integer NOT NULL,
	"build" boolean NOT NULL,
	"modify" boolean NOT NULL,
	"modify_otu" boolean NOT NULL,
	CONSTRAINT "legacy_reference_groups_pkey" PRIMARY KEY("reference_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "legacy_reference_users" (
	"reference_id" bigint NOT NULL,
	"user_id" integer NOT NULL,
	"build" boolean NOT NULL,
	"modify" boolean NOT NULL,
	"modify_otu" boolean NOT NULL,
	CONSTRAINT "legacy_reference_users_pkey" PRIMARY KEY("reference_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "legacy_references" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "legacy_references_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"legacy_id" text,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"organism" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"archived" boolean NOT NULL,
	"restrict_source_types" boolean NOT NULL,
	"source_types" jsonb NOT NULL,
	"user_id" integer NOT NULL,
	"upload_id" integer,
	"cloned_from_id" bigint,
	"task_id" integer,
	CONSTRAINT "legacy_references_legacy_id_key" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "legacy_sample_labels" (
	"sample_id" bigint NOT NULL,
	"label_id" integer NOT NULL,
	CONSTRAINT "legacy_sample_labels_pkey" PRIMARY KEY("sample_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "legacy_sample_subtractions" (
	"sample_id" bigint NOT NULL,
	"subtraction_id" bigint NOT NULL,
	CONSTRAINT "legacy_sample_subtractions_pkey" PRIMARY KEY("sample_id","subtraction_id")
);
--> statement-breakpoint
CREATE TABLE "legacy_samples" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "legacy_samples_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"legacy_id" text,
	"name" text NOT NULL,
	"host" text NOT NULL,
	"isolate" text NOT NULL,
	"locale" text NOT NULL,
	"notes" text NOT NULL,
	"library_type" text NOT NULL,
	"format" text NOT NULL,
	"group_id" integer,
	"quality" jsonb,
	"created_at" timestamp NOT NULL,
	"paired" boolean NOT NULL,
	"ready" boolean NOT NULL,
	"hold" boolean NOT NULL,
	"is_legacy" boolean NOT NULL,
	"all_read" boolean NOT NULL,
	"all_write" boolean NOT NULL,
	"group_read" boolean NOT NULL,
	"group_write" boolean NOT NULL,
	"user_id" integer,
	"job_id" integer,
	CONSTRAINT "legacy_samples_legacy_id_key" UNIQUE("legacy_id"),
	CONSTRAINT "legacy_samples_job_id_key" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "sample_reads" (
	"id" serial PRIMARY KEY NOT NULL,
	"sample" text NOT NULL,
	"sample_id" bigint,
	"name" varchar(13) NOT NULL,
	"name_on_disk" text NOT NULL,
	"size" bigint,
	"storage_key" text NOT NULL,
	"upload" integer,
	"uploaded_at" timestamp,
	CONSTRAINT "uq_sample_reads_storage_key" UNIQUE("storage_key"),
	CONSTRAINT "sample_reads_sample_id_name_key" UNIQUE("sample_id","name"),
	CONSTRAINT "sample_reads_sample_name_key" UNIQUE("sample","name")
);
--> statement-breakpoint
CREATE TABLE "sample_uploads" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sample_uploads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"sample" text NOT NULL,
	"sample_id" bigint,
	"upload_id" integer NOT NULL,
	"index" integer NOT NULL,
	CONSTRAINT "sample_uploads_upload_id_key" UNIQUE("upload_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" integer,
	"ip" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token_hash" text,
	"reset_code" text,
	"reset_remember" boolean,
	"session_type" text NOT NULL,
	CONSTRAINT "sessions_session_id_key" UNIQUE("session_id"),
	CONSTRAINT "session_type_valid" CHECK ("sessions"."session_type" in ('anonymous', 'authenticated', 'reset'))
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"default_source_types" jsonb NOT NULL,
	"enable_api" boolean NOT NULL,
	"enable_sentry" boolean NOT NULL,
	"minimum_password_length" integer NOT NULL,
	"sample_all_read" boolean NOT NULL,
	"sample_all_write" boolean NOT NULL,
	"sample_group" text NOT NULL,
	"sample_group_read" boolean NOT NULL,
	"sample_group_write" boolean NOT NULL,
	CONSTRAINT "ck_settings_singleton" CHECK ("settings"."id" = 1),
	CONSTRAINT "ck_settings_sample_group" CHECK ("settings"."sample_group" in ('none', 'force_choice', 'users_primary_group'))
);
--> statement-breakpoint
CREATE TABLE "subtraction_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"subtraction_id" bigint NOT NULL,
	"type" "subtractiontype",
	"size" bigint,
	"storage_key" text,
	CONSTRAINT "uq_subtraction_files_storage_key" UNIQUE("storage_key"),
	CONSTRAINT "subtraction_files_subtraction_id_name_key" UNIQUE("subtraction_id","name")
);
--> statement-breakpoint
CREATE TABLE "subtractions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "subtractions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"legacy_id" text,
	"name" text NOT NULL,
	"nickname" text NOT NULL,
	"count" integer,
	"gc" jsonb,
	"created_at" timestamp NOT NULL,
	"deleted" boolean NOT NULL,
	"ready" boolean NOT NULL,
	"user_id" integer,
	"job_id" integer,
	"upload_id" integer,
	CONSTRAINT "subtractions_legacy_id_key" UNIQUE("legacy_id"),
	CONSTRAINT "subtractions_job_id_key" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"acquired_at" timestamp,
	"complete" boolean,
	"context" jsonb,
	"count" integer,
	"created_at" timestamp NOT NULL,
	"error" text,
	"file_size" bigint,
	"progress" integer,
	"runner_id" varchar(255),
	"step" text,
	"type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp,
	"name" text,
	"name_on_disk" text,
	"ready" boolean NOT NULL,
	"removed" boolean NOT NULL,
	"removed_at" timestamp,
	"reserved" boolean NOT NULL,
	"size" bigint,
	"storage_key" text,
	"type" text,
	"uploaded_at" timestamp,
	"user_id" integer NOT NULL,
	CONSTRAINT "uploads_name_on_disk_key" UNIQUE("name_on_disk"),
	CONSTRAINT "uq_uploads_storage_key" UNIQUE("storage_key"),
	CONSTRAINT "ck_uploads_type" CHECK ("uploads"."type" in ('reference', 'reads', 'subtraction'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"active" boolean NOT NULL,
	"administrator_role" text,
	"email" text NOT NULL,
	"force_reset" boolean NOT NULL,
	"handle" text NOT NULL,
	"last_password_change" timestamp NOT NULL,
	"legacy_id" text,
	"password" "bytea" NOT NULL,
	"settings" jsonb NOT NULL,
	CONSTRAINT "users_legacy_id_key" UNIQUE("legacy_id"),
	CONSTRAINT "administrator_role_valid" CHECK ("users"."administrator_role" in ('full', 'settings', 'users', 'base'))
);
--> statement-breakpoint
CREATE TABLE "analysis_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"analysis_id" text NOT NULL,
	"results" jsonb NOT NULL,
	CONSTRAINT "analysis_results_analysis_id_key" UNIQUE("analysis_id")
);
--> statement-breakpoint
CREATE TABLE "job_analyses" (
	"job_id" integer NOT NULL,
	"analysis_id" text NOT NULL,
	CONSTRAINT "job_analyses_pkey" PRIMARY KEY("job_id")
);
--> statement-breakpoint
CREATE TABLE "job_indexes" (
	"job_id" integer NOT NULL,
	"index_id" text NOT NULL,
	CONSTRAINT "job_indexes_pkey" PRIMARY KEY("job_id")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"description" text,
	"resource_type" "resourcetype",
	"action" "action"
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "public"."legacy_samples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "public"."legacy_references"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_index_id_fkey" FOREIGN KEY ("index_id") REFERENCES "public"."indexes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_files" ADD CONSTRAINT "analysis_files_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_subtractions" ADD CONSTRAINT "analysis_subtractions_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_subtractions" ADD CONSTRAINT "analysis_subtractions_subtraction_id_fkey" FOREIGN KEY ("subtraction_id") REFERENCES "public"."subtractions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nuvs_blast" ADD CONSTRAINT "nuvs_blast_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nuvs_blast" ADD CONSTRAINT "nuvs_blast_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_history" ADD CONSTRAINT "legacy_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_history" ADD CONSTRAINT "legacy_history_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "public"."legacy_references"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_history" ADD CONSTRAINT "legacy_history_index_id_fkey" FOREIGN KEY ("index_id") REFERENCES "public"."indexes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_history_diff" ADD CONSTRAINT "legacy_history_diff_history_id_fkey" FOREIGN KEY ("history_id") REFERENCES "public"."legacy_history"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_hmm_status" ADD CONSTRAINT "legacy_hmm_status_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_files" ADD CONSTRAINT "index_files_index_id_fkey" FOREIGN KEY ("index_id") REFERENCES "public"."indexes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indexes" ADD CONSTRAINT "indexes_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "public"."legacy_references"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indexes" ADD CONSTRAINT "indexes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indexes" ADD CONSTRAINT "indexes_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indexes" ADD CONSTRAINT "indexes_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instance_messages" ADD CONSTRAINT "instance_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_otus" ADD CONSTRAINT "legacy_otus_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "public"."legacy_references"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_sequences" ADD CONSTRAINT "legacy_sequences_otu_id_fkey" FOREIGN KEY ("otu_id") REFERENCES "public"."legacy_otus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_reference_groups" ADD CONSTRAINT "legacy_reference_groups_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "public"."legacy_references"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_reference_groups" ADD CONSTRAINT "legacy_reference_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_reference_users" ADD CONSTRAINT "legacy_reference_users_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "public"."legacy_references"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_reference_users" ADD CONSTRAINT "legacy_reference_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_references" ADD CONSTRAINT "legacy_references_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_references" ADD CONSTRAINT "legacy_references_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_references" ADD CONSTRAINT "legacy_references_cloned_from_id_fkey" FOREIGN KEY ("cloned_from_id") REFERENCES "public"."legacy_references"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_references" ADD CONSTRAINT "legacy_references_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_sample_labels" ADD CONSTRAINT "legacy_sample_labels_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "public"."legacy_samples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_sample_labels" ADD CONSTRAINT "legacy_sample_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_sample_subtractions" ADD CONSTRAINT "legacy_sample_subtractions_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "public"."legacy_samples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_sample_subtractions" ADD CONSTRAINT "legacy_sample_subtractions_subtraction_id_fkey" FOREIGN KEY ("subtraction_id") REFERENCES "public"."subtractions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_samples" ADD CONSTRAINT "legacy_samples_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_samples" ADD CONSTRAINT "legacy_samples_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_samples" ADD CONSTRAINT "legacy_samples_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sample_reads" ADD CONSTRAINT "sample_reads_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "public"."legacy_samples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sample_reads" ADD CONSTRAINT "sample_reads_upload_fkey" FOREIGN KEY ("upload") REFERENCES "public"."uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sample_uploads" ADD CONSTRAINT "sample_uploads_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "public"."legacy_samples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sample_uploads" ADD CONSTRAINT "sample_uploads_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtraction_files" ADD CONSTRAINT "subtraction_files_subtraction_id_fkey" FOREIGN KEY ("subtraction_id") REFERENCES "public"."subtractions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtractions" ADD CONSTRAINT "subtractions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtractions" ADD CONSTRAINT "subtractions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtractions" ADD CONSTRAINT "subtractions_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_analyses" ADD CONSTRAINT "job_analyses_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_indexes" ADD CONSTRAINT "job_indexes_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_analyses_sample" ON "analyses" USING btree ("sample");--> statement-breakpoint
CREATE INDEX "ix_analyses_sample_id_workflow" ON "analyses" USING btree ("sample_id","workflow");--> statement-breakpoint
CREATE INDEX "ix_analysis_subtractions_subtraction_id" ON "analysis_subtractions" USING btree ("subtraction_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_user_id" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_caches_last_accessed_at_id" ON "caches" USING btree ("last_accessed_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "primary_group_unique" ON "user_groups" USING btree ("primary","user_id") WHERE false;--> statement-breakpoint
CREATE INDEX "ix_legacy_history_index" ON "legacy_history" USING btree ("index");--> statement-breakpoint
CREATE INDEX "ix_legacy_history_index_id" ON "legacy_history" USING btree ("index_id");--> statement-breakpoint
CREATE INDEX "ix_legacy_history_otu_otu_version" ON "legacy_history" USING btree ("otu","otu_version" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "ix_legacy_history_reference" ON "legacy_history" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "ix_legacy_history_reference_id" ON "legacy_history" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "ix_legacy_history_user_id" ON "legacy_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_jobs_state_created_at" ON "jobs" USING btree ("state","created_at");--> statement-breakpoint
CREATE INDEX "ix_jobs_user_id_state" ON "jobs" USING btree ("user_id","state");--> statement-breakpoint
CREATE INDEX "ix_jobs_workflow_state" ON "jobs" USING btree ("workflow","state");--> statement-breakpoint
CREATE UNIQUE INDEX "instance_messages_one_active" ON "instance_messages" USING btree ("active") WHERE "instance_messages"."active" = true;--> statement-breakpoint
CREATE INDEX "ix_legacy_otus_reference_id" ON "legacy_otus" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "legacy_otus_name_lower" ON "legacy_otus" USING btree (lower("name"),"id");--> statement-breakpoint
CREATE INDEX "ix_legacy_sequences_otu_id" ON "legacy_sequences" USING btree ("otu_id");--> statement-breakpoint
CREATE INDEX "ix_legacy_sequences_otu_id_position" ON "legacy_sequences" USING btree ("otu_id","position");--> statement-breakpoint
CREATE INDEX "ix_legacy_samples_all_read" ON "legacy_samples" USING btree ("all_read") WHERE "legacy_samples"."all_read" = true;--> statement-breakpoint
CREATE INDEX "ix_legacy_samples_group_id" ON "legacy_samples" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "ix_legacy_samples_group_read" ON "legacy_samples" USING btree ("group_read") WHERE "legacy_samples"."group_read" = true;--> statement-breakpoint
CREATE INDEX "ix_legacy_samples_user_id_created_at" ON "legacy_samples" USING btree ("user_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "idx_sessions_expires_at" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sessions_session_id" ON "sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_type" ON "sessions" USING btree ("session_type");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_active" ON "tasks" USING btree ("acquired_at") WHERE "tasks"."complete" = false and "tasks"."error" is null;--> statement-breakpoint
CREATE INDEX "idx_tasks_unacquired" ON "tasks" USING btree ("acquired_at") WHERE "tasks"."acquired_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_handle_lower_unique" ON "users" USING btree (lower("handle"));