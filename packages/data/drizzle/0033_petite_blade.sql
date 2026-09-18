ALTER TABLE "auth_sessions" ADD COLUMN "last_activity_at" timestamp;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "idle_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "absolute_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "last_refreshed_at" timestamp;--> statement-breakpoint
DELETE FROM "auth_sessions";--> statement-breakpoint
ALTER TABLE "auth_sessions" ALTER COLUMN "last_activity_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_sessions" ALTER COLUMN "idle_expires_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_sessions" ALTER COLUMN "absolute_expires_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_sessions" ALTER COLUMN "last_refreshed_at" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_auth_sessions_absolute_expires_at" ON "auth_sessions" USING btree ("absolute_expires_at");
