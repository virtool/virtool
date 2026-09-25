DROP INDEX "users_handle_lower_unique";--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "setup_token_id" integer;--> statement-breakpoint
ALTER TABLE "setup_tokens" ADD COLUMN "issuer_user_id" integer;--> statement-breakpoint
ALTER TABLE "setup_tokens" ADD COLUMN "generation" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "setup_tokens" ADD COLUMN "delivery" text;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_setup_token_id_fkey" FOREIGN KEY ("setup_token_id") REFERENCES "public"."setup_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_setup_tokens_live_account_completion" ON "setup_tokens" USING btree ("user_id") WHERE "setup_tokens"."purpose" = 'account_completion' and "setup_tokens"."consumed_at" is null and "setup_tokens"."superseded_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_handle_lower_unique" ON "users" USING btree (lower("handle")) WHERE "users"."handle" <> '';--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "uq_email_outbox_setup_token_id" UNIQUE("setup_token_id");--> statement-breakpoint
ALTER TABLE "setup_tokens" ADD CONSTRAINT "setup_tokens_generation_positive" CHECK ("setup_tokens"."generation" > 0);--> statement-breakpoint
ALTER TABLE "setup_tokens" ADD CONSTRAINT "setup_tokens_invitation_metadata_valid" CHECK ("setup_tokens"."purpose" <> 'account_completion' or ("setup_tokens"."issuer_user_id" is not null and "setup_tokens"."delivery" in ('copy_only', 'queued')));