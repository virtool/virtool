DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.data_migrations
                 WHERE key = 'legacy_identities' AND version = 2 AND status = 'passed')
  THEN RAISE EXCEPTION 'data migration legacy_identities@2 has not passed';
  END IF;
END $$;
