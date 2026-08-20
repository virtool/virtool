ALTER TABLE "indexes" DROP CONSTRAINT "indexes_storage_key_key";--> statement-breakpoint
DROP INDEX "ix_legacy_history_index";--> statement-breakpoint
DROP INDEX "ix_legacy_history_reference";--> statement-breakpoint
ALTER TABLE "legacy_history" ALTER COLUMN "reference_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "analyses" DROP COLUMN "index";--> statement-breakpoint
ALTER TABLE "legacy_history" DROP COLUMN "reference";--> statement-breakpoint
ALTER TABLE "legacy_history" DROP COLUMN "index";--> statement-breakpoint
ALTER TABLE "index_files" DROP COLUMN "index";--> statement-breakpoint
ALTER TABLE "indexes" DROP COLUMN "storage_key";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "enable_api";