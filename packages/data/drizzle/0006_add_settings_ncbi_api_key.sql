-- The default is transient. `settings` already carries its singleton row, so a
-- NOT NULL column cannot be added without one; and no column in this table has
-- a server default — every value is written on insert from `DEFAULT_SETTINGS` —
-- so the default is dropped again once the existing row has been filled.
ALTER TABLE "settings" ADD COLUMN "ncbi_api_key" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "ncbi_api_key" DROP DEFAULT;
