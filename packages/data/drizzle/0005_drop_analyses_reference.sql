ALTER TABLE "analyses" DROP CONSTRAINT "ck_analyses_reference_present";--> statement-breakpoint
ALTER TABLE "analyses" DROP CONSTRAINT "analyses_reference_id_fkey";
--> statement-breakpoint
ALTER TABLE "analyses" DROP COLUMN "reference";--> statement-breakpoint
ALTER TABLE "analyses" DROP COLUMN "reference_id";
