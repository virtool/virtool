ALTER TABLE "auth_sessions" ADD COLUMN "last_activity_at" timestamp;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "idle_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "absolute_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "last_refreshed_at" timestamp;--> statement-breakpoint
UPDATE "auth_sessions"
SET
	"last_activity_at" = "updated_at",
	"expires_at" = least("expires_at", "updated_at" + interval '1 hour', "created_at" + interval '24 hours'),
	"idle_expires_at" = least("expires_at", "updated_at" + interval '1 hour', "created_at" + interval '24 hours'),
	"absolute_expires_at" = least("expires_at", "created_at" + interval '24 hours'),
	"last_refreshed_at" = "updated_at";--> statement-breakpoint
ALTER TABLE "auth_sessions" ALTER COLUMN "last_activity_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_sessions" ALTER COLUMN "idle_expires_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_sessions" ALTER COLUMN "absolute_expires_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_sessions" ALTER COLUMN "last_refreshed_at" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_auth_sessions_absolute_expires_at" ON "auth_sessions" USING btree ("absolute_expires_at");
