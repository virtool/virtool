DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.data_migrations
                 WHERE key = 'passkey_credential_uniqueness' AND version = 1 AND status = 'passed')
  THEN RAISE EXCEPTION 'data migration passkey_credential_uniqueness@1 has not passed';
  END IF;
END $$;--> statement-breakpoint
DROP INDEX "idx_auth_passkeys_credential_id";--> statement-breakpoint
ALTER TABLE "auth_passkeys" ADD CONSTRAINT "auth_passkeys_credential_id_key" UNIQUE("credential_id");
