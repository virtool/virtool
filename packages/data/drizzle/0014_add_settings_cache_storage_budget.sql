-- The default is transient. `settings` already carries its singleton row, so a
-- NOT NULL column cannot be added without one; and no column in this table has
-- a server default — every value is written on insert from `DEFAULT_SETTINGS` —
-- so the default is dropped again once the existing row has been filled. The
-- default matches `CACHE_STORAGE_BUDGET_BYTES` (100 GiB).
ALTER TABLE "settings" ADD COLUMN "cache_storage_budget" bigint NOT NULL DEFAULT 107374182400;--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "cache_storage_budget" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "ck_settings_cache_storage_budget" CHECK ("settings"."cache_storage_budget" > 0);
