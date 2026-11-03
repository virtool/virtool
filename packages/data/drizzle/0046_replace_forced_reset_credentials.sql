DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.data_migrations
                 WHERE key = 'forced_password_reset' AND version = 1 AND status = 'passed')
  THEN RAISE EXCEPTION 'data migration forced_password_reset@1 has not passed';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "users" VALIDATE CONSTRAINT "force_reset_unset";
