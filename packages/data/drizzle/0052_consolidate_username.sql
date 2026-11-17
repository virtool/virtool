DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.data_migrations
                 WHERE key = 'username_backfill' AND version = 1 AND status = 'passed')
  THEN RAISE EXCEPTION 'data migration username_backfill@1 has not passed';
  END IF;
END $$;--> statement-breakpoint
-- The mirror no longer declares users.handle or users.display_username. Servers
-- from earlier releases still name them, so a later release drops them. New
-- servers don't write handle, so it needs a default until then.
ALTER TABLE "users" ALTER COLUMN "handle" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "username_lowercase" CHECK ("users"."username" = lower("users"."username"));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "pending_has_no_username" CHECK ("users"."lifecycle_state" <> 'pending' or "users"."username" is null);
