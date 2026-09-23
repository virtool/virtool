DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.data_migrations
                 WHERE key = 'current_isolate_segments' AND version = 1 AND status = 'passed')
  THEN RAISE EXCEPTION 'data migration current_isolate_segments@1 has not passed';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX "otu_sequence_versions_current_isolate_segment_key" ON "otu_sequence_versions" USING btree ("otu_id","isolate_id","segment_id") WHERE "otu_sequence_versions"."last_version" is null;
