ALTER TABLE "analysis_files" RENAME CONSTRAINT "uq_analysis_files_storage_key" TO "analysis_files_storage_key_key";--> statement-breakpoint
ALTER TABLE "legacy_history_diff" RENAME CONSTRAINT "history_diffs_change_id_key" TO "legacy_history_diff_change_id_key";--> statement-breakpoint
ALTER TABLE "index_files" RENAME CONSTRAINT "uq_index_files_storage_key" TO "index_files_storage_key_key";--> statement-breakpoint
ALTER TABLE "indexes" RENAME CONSTRAINT "uq_indexes_otus_json_storage_key" TO "indexes_otus_json_storage_key_key";--> statement-breakpoint
ALTER TABLE "sample_reads" RENAME CONSTRAINT "uq_sample_reads_storage_key" TO "sample_reads_storage_key_key";--> statement-breakpoint
ALTER TABLE "subtraction_files" RENAME CONSTRAINT "uq_subtraction_files_storage_key" TO "subtraction_files_storage_key_key";--> statement-breakpoint
ALTER TABLE "uploads" RENAME CONSTRAINT "uq_uploads_storage_key" TO "uploads_storage_key_key";--> statement-breakpoint
ALTER TABLE "legacy_history_diff" RENAME CONSTRAINT "history_diffs_pkey" TO "legacy_history_diff_pkey";
