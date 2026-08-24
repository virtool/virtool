ALTER TABLE "instance_messages" RENAME TO "banners";--> statement-breakpoint
ALTER TABLE "banners" RENAME CONSTRAINT "instance_messages_user_id_fkey" TO "banners_user_id_fkey";--> statement-breakpoint
ALTER TABLE "banners" RENAME CONSTRAINT "ck_instance_messages_color" TO "ck_banners_color";--> statement-breakpoint
ALTER INDEX "instance_messages_one_active" RENAME TO "banners_one_active";--> statement-breakpoint
ALTER SEQUENCE "instance_messages_id_seq" RENAME TO "banners_id_seq";
