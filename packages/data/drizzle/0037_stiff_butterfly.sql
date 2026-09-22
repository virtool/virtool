UPDATE "auth_sessions"
SET "ip_address" = left(regexp_replace("ip_address", '[[:cntrl:]]', ' ', 'g'), 45),
	"user_agent" = left(regexp_replace("user_agent", '[[:cntrl:]]', ' ', 'g'), 512);--> statement-breakpoint
ALTER TABLE "auth_sessions" ALTER COLUMN "ip_address" SET DATA TYPE varchar(45);--> statement-breakpoint
ALTER TABLE "auth_sessions" ALTER COLUMN "user_agent" SET DATA TYPE varchar(512);--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "replacement_for_session_id" integer;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_replacement_for_session_id_fkey" FOREIGN KEY ("replacement_for_session_id") REFERENCES "public"."auth_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_auth_sessions_replacement_for_session_id" ON "auth_sessions" USING btree ("replacement_for_session_id");
