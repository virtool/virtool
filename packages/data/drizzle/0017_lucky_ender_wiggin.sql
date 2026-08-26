CREATE TABLE "analysis_views" (
	"user_id" integer NOT NULL,
	"analysis_id" bigint NOT NULL,
	"viewed_at" timestamp NOT NULL,
	CONSTRAINT "analysis_views_pkey" PRIMARY KEY("user_id","analysis_id")
);
--> statement-breakpoint
CREATE TABLE "sample_views" (
	"user_id" integer NOT NULL,
	"sample_id" bigint NOT NULL,
	"viewed_at" timestamp NOT NULL,
	CONSTRAINT "sample_views_pkey" PRIMARY KEY("user_id","sample_id")
);
--> statement-breakpoint
ALTER TABLE "analysis_views" ADD CONSTRAINT "analysis_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_views" ADD CONSTRAINT "analysis_views_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sample_views" ADD CONSTRAINT "sample_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sample_views" ADD CONSTRAINT "sample_views_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "public"."legacy_samples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_analysis_views_user_id_viewed_at" ON "analysis_views" USING btree ("user_id","viewed_at");--> statement-breakpoint
CREATE INDEX "ix_sample_views_user_id_viewed_at" ON "sample_views" USING btree ("user_id","viewed_at");