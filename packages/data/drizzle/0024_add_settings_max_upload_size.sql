-- Backfill existing settings with 5 GB, matching DEFAULT_MAX_UPLOAD_SIZE.
-- Future inserts supply the value from DEFAULT_SETTINGS, so drop the SQL default.
ALTER TABLE "settings" ADD COLUMN "max_upload_size" bigint NOT NULL DEFAULT 5000000000;--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "max_upload_size" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "ck_settings_max_upload_size" CHECK ("settings"."max_upload_size" > 0 AND "settings"."max_upload_size" <= 120000000000);
