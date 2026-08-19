DROP TRIGGER IF EXISTS "instance_messages_sync_user_id" ON "instance_messages";--> statement-breakpoint
DROP FUNCTION IF EXISTS "sync_instance_messages_user_id"();--> statement-breakpoint
ALTER TABLE "instance_messages" DROP COLUMN "user";
