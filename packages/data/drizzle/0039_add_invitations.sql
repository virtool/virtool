ALTER TABLE "setup_tokens" ADD COLUMN "issuer_user_id" integer;--> statement-breakpoint
ALTER TABLE "setup_tokens" ADD COLUMN "generation" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "setup_tokens" ADD COLUMN "delivery" text;--> statement-breakpoint
ALTER TABLE "setup_tokens" ADD COLUMN "outbox_id" integer;--> statement-breakpoint
ALTER TABLE "setup_tokens" ADD COLUMN "revoked_at" timestamp;--> statement-breakpoint
ALTER TABLE "setup_tokens" ADD CONSTRAINT "setup_tokens_outbox_id_fkey" FOREIGN KEY ("outbox_id") REFERENCES "public"."email_outbox"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_setup_tokens_live_account_completion" ON "setup_tokens" USING btree ("user_id") WHERE "setup_tokens"."purpose" = 'account_completion' and "setup_tokens"."consumed_at" is null and "setup_tokens"."superseded_at" is null and "setup_tokens"."revoked_at" is null;--> statement-breakpoint
ALTER TABLE "setup_tokens" ADD CONSTRAINT "setup_tokens_generation_positive" CHECK ("setup_tokens"."generation" > 0);--> statement-breakpoint
ALTER TABLE "setup_tokens" ADD CONSTRAINT "setup_tokens_invitation_metadata_valid" CHECK ("setup_tokens"."purpose" <> 'account_completion' or ("setup_tokens"."issuer_user_id" is not null and "setup_tokens"."delivery" in ('copy_only', 'queued')));--> statement-breakpoint
ALTER TABLE "setup_tokens" ADD CONSTRAINT "setup_tokens_delivery_outbox_valid" CHECK ("setup_tokens"."outbox_id" is null or "setup_tokens"."delivery" = 'queued');
