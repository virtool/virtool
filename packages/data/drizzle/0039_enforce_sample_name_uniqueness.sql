DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.data_migrations
                 WHERE key = 'sample_name_uniqueness' AND version = 1 AND status = 'passed')
  THEN RAISE EXCEPTION 'data migration sample_name_uniqueness@1 has not passed';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "legacy_samples" ADD CONSTRAINT "legacy_samples_name_key" UNIQUE("name");
