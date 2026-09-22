ALTER TABLE "reference_roots" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "reference_roots" ADD CONSTRAINT "reference_roots_version_check" CHECK ("reference_roots"."version" >= 1);--> statement-breakpoint
ALTER TABLE "reference_groups" RENAME CONSTRAINT "reference_groups_build_not_null" TO "reference_groups_publish_version_not_null";--> statement-breakpoint
ALTER TABLE "reference_users" RENAME CONSTRAINT "reference_users_build_not_null" TO "reference_users_publish_version_not_null";
