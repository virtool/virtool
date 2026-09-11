import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	integer,
	pgTable,
	timestamp,
} from "drizzle-orm/pg-core";

export const cacheUsageSnapshots = pgTable(
	"cache_usage_snapshots",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		recorded_at: timestamp("recorded_at").notNull(),
		cache_count: integer("cache_count").notNull(),
		total_size: bigint("total_size", { mode: "number" }).notNull(),
	},
	(table) => [
		check(
			"ck_cache_usage_snapshots_cache_count",
			sql`${table.cache_count} >= 0`,
		),
		check("ck_cache_usage_snapshots_total_size", sql`${table.total_size} >= 0`),
	],
);

/** A recorded aggregate of workflow cache usage. */
export type CacheUsageSnapshotRow = typeof cacheUsageSnapshots.$inferSelect;
