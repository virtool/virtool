-- The default is transient, exactly as in `0014_add_settings_cache_storage_budget`.
-- `settings` already carries its singleton row, so a NOT NULL column cannot be
-- added without one; and no column in this table has a server default — every
-- value is written on insert from `DEFAULT_SETTINGS` — so the default is
-- dropped again once the existing row has been filled. The default matches
-- `DEFAULT_MAX_UPLOAD_SIZE` (5 GB).
ALTER TABLE "settings" ADD COLUMN "max_upload_size" bigint NOT NULL DEFAULT 5000000000;--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "max_upload_size" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "ck_settings_max_upload_size" CHECK ("settings"."max_upload_size" > 0);
