ALTER TABLE "users" ALTER COLUMN "force_reset" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "force_reset_unset" CHECK ("users"."force_reset" = false) NOT VALID;
