CREATE TABLE "cache_usage_snapshots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cache_usage_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"recorded_at" timestamp NOT NULL,
	"cache_count" integer NOT NULL,
	"total_size" bigint NOT NULL,
	CONSTRAINT "ck_cache_usage_snapshots_cache_count" CHECK ("cache_usage_snapshots"."cache_count" >= 0),
	CONSTRAINT "ck_cache_usage_snapshots_total_size" CHECK ("cache_usage_snapshots"."total_size" >= 0)
);
