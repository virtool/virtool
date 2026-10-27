CREATE TABLE "email_outbox" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "email_outbox_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"accepted_at" timestamp,
	"attempt_count" integer NOT NULL,
	"claim_expires_at" timestamp,
	"claim_token" text,
	"created_at" timestamp NOT NULL,
	"idempotency_key" text NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp NOT NULL,
	"provider_message_id" text,
	"recipient" text NOT NULL,
	"status" text NOT NULL,
	"template" jsonb NOT NULL,
	"template_version" integer NOT NULL,
	"terminal_at" timestamp,
	CONSTRAINT "uq_email_outbox_idempotency_key" UNIQUE("idempotency_key"),
	CONSTRAINT "ck_email_outbox_status" CHECK ("email_outbox"."status" in ('queued', 'accepted', 'failed')),
	CONSTRAINT "ck_email_outbox_attempt_count" CHECK ("email_outbox"."attempt_count" >= 0)
);
--> statement-breakpoint
-- The defaults are transient. `settings` already carries its singleton row, so
-- a NOT NULL column cannot be added without one; and no column in this table
-- has a server default — every value is written on insert from
-- `DEFAULT_SETTINGS` — so each default is dropped again once the existing row
-- has been filled. Email stays disabled on upgrade. `email_api_key` is
-- nullable — null is "no key stored" — so it needs no default.
ALTER TABLE "settings" ADD COLUMN "email_api_key" jsonb;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "email_enabled" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "email_enabled" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "email_reply_to_address" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "email_reply_to_address" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "email_sender_address" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "email_sender_address" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "email_sender_name" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "email_sender_name" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "idx_email_outbox_due" ON "email_outbox" USING btree ("next_attempt_at") WHERE "email_outbox"."status" = 'queued';--> statement-breakpoint
CREATE INDEX "idx_email_outbox_terminal" ON "email_outbox" USING btree ("terminal_at") WHERE "email_outbox"."status" in ('accepted', 'failed');