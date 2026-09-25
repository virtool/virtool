ALTER TABLE "legacy_reference_groups" DROP CONSTRAINT "legacy_reference_groups_group_id_fkey";
--> statement-breakpoint
ALTER TABLE "legacy_sample_labels" DROP CONSTRAINT "legacy_sample_labels_label_id_fkey";
--> statement-breakpoint
ALTER TABLE "legacy_samples" DROP CONSTRAINT "legacy_samples_group_id_fkey";
--> statement-breakpoint
ALTER TABLE "legacy_reference_groups" ADD CONSTRAINT "legacy_reference_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_sample_labels" ADD CONSTRAINT "legacy_sample_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_samples" ADD CONSTRAINT "legacy_samples_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;