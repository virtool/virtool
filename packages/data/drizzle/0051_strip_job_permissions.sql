UPDATE "groups" SET "permissions" = "permissions" - 'cancel_job' - 'remove_job';--> statement-breakpoint
UPDATE "api_keys" SET "permissions" = "permissions" - 'cancel_job' - 'remove_job';
