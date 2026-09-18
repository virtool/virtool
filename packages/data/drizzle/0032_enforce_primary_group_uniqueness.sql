DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.data_migrations
                 WHERE key = 'primary_group_uniqueness' AND version = 1 AND status = 'passed')
  THEN RAISE EXCEPTION 'data migration primary_group_uniqueness@1 has not passed';
  END IF;
END $$;--> statement-breakpoint
DROP INDEX "primary_group_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "primary_group_unique" ON "user_groups" USING btree ("user_id") WHERE "user_groups"."primary" = true;
