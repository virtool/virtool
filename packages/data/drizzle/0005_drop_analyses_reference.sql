DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "analyses" AS "analysis"
		INNER JOIN "indexes" AS "index" ON "index"."id" = "analysis"."index_id"
		WHERE "analysis"."reference_id" IS DISTINCT FROM "index"."reference_id"
	) THEN
		RAISE EXCEPTION 'analyses.reference_id does not match indexes.reference_id';
	END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "analyses" DROP CONSTRAINT "ck_analyses_reference_present";--> statement-breakpoint
ALTER TABLE "analyses" DROP CONSTRAINT "analyses_reference_id_fkey";
--> statement-breakpoint
ALTER TABLE "analyses" DROP COLUMN "reference";--> statement-breakpoint
ALTER TABLE "analyses" DROP COLUMN "reference_id";
