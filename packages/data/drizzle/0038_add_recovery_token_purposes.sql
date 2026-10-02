ALTER TABLE "setup_sessions" DROP CONSTRAINT "setup_sessions_purpose_valid";--> statement-breakpoint
ALTER TABLE "setup_tokens" DROP CONSTRAINT "setup_tokens_purpose_valid";--> statement-breakpoint
ALTER TABLE "setup_tokens" ADD COLUMN "source_email" text;--> statement-breakpoint
ALTER TABLE "setup_sessions" ADD CONSTRAINT "setup_sessions_purpose_valid" CHECK (purpose in ('account_completion', 'email_remediation', 'totp_enrollment', 'email_verification', 'password_recovery', 'administrator_recovery'));--> statement-breakpoint
ALTER TABLE "setup_tokens" ADD CONSTRAINT "setup_tokens_purpose_valid" CHECK (purpose in ('account_completion', 'email_remediation', 'totp_enrollment', 'email_verification', 'password_recovery', 'administrator_recovery'));