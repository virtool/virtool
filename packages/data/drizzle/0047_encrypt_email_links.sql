ALTER TABLE "email_outbox" ADD COLUMN "link" jsonb;--> statement-breakpoint
-- A terminal row is never rendered again, so its link has no further use.
-- Queued rows keep theirs: this migration has no encryption key, and delivery
-- clears them when they reach a terminal state.
UPDATE "email_outbox"
SET "template" = "template" - 'setupUrl' - 'verifyUrl' - 'recoveryUrl'
WHERE "status" IN ('accepted', 'failed');
