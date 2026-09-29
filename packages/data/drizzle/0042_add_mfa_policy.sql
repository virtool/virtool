DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.data_migrations
                 WHERE key = 'totp_enrollment_setup_state' AND version = 1 AND status = 'passed')
  THEN RAISE EXCEPTION 'data migration totp_enrollment_setup_state@1 has not passed';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "setup_sessions" DROP CONSTRAINT "setup_sessions_purpose_valid";--> statement-breakpoint
ALTER TABLE "setup_tokens" DROP CONSTRAINT "setup_tokens_purpose_valid";--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "mfa_policy" text NOT NULL DEFAULT 'optional';--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "mfa_policy" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "ck_settings_mfa_policy" CHECK ("settings"."mfa_policy" in ('optional', 'required'));--> statement-breakpoint
ALTER TABLE "setup_sessions" ADD CONSTRAINT "setup_sessions_purpose_valid" CHECK (purpose in ('account_completion', 'email_remediation', 'email_verification', 'password_recovery', 'administrator_recovery'));--> statement-breakpoint
ALTER TABLE "setup_tokens" ADD CONSTRAINT "setup_tokens_purpose_valid" CHECK (purpose in ('account_completion', 'email_remediation', 'email_verification', 'password_recovery', 'administrator_recovery'));
