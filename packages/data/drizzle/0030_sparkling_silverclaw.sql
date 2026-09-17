DELETE FROM "auth_sessions";
--> statement-breakpoint
CREATE INDEX "idx_auth_sessions_expires_at" ON "auth_sessions" USING btree ("expires_at");
--> statement-breakpoint
DROP TABLE "sessions";
