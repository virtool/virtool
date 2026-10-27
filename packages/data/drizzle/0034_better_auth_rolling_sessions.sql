DROP INDEX "idx_auth_sessions_absolute_expires_at";--> statement-breakpoint
ALTER TABLE "auth_sessions" DROP COLUMN "last_activity_at";--> statement-breakpoint
ALTER TABLE "auth_sessions" DROP COLUMN "idle_expires_at";--> statement-breakpoint
ALTER TABLE "auth_sessions" DROP COLUMN "absolute_expires_at";--> statement-breakpoint
ALTER TABLE "auth_sessions" DROP COLUMN "last_refreshed_at";