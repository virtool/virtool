import type { CacheUsageSnapshot } from "@virtool/contracts";
import { asc, desc, sql } from "drizzle-orm";
import type { Db } from "../db/pg";
import { caches } from "../db/schema/caches";
import { cacheUsageSnapshots } from "../db/schema/cacheUsageSnapshots";

/** Maximum hourly cache-usage snapshots retained, equivalent to 30 days. */
export const CACHE_USAGE_SNAPSHOT_LIMIT = 720;

/** Record current aggregate cache usage and discard snapshots beyond the limit. */
export async function recordCacheUsage(
	db: Db,
	recordedAt: Date = new Date(),
): Promise<CacheUsageSnapshot> {
	return db.transaction(async (tx) => {
		const [snapshot] = await tx.execute<
			Pick<CacheUsageSnapshot, "cacheCount" | "totalSize">
		>(sql`
			insert into ${cacheUsageSnapshots} (recorded_at, cache_count, total_size)
			select
				${sql.param(recordedAt, cacheUsageSnapshots.recorded_at)},
				count(*)::int,
				coalesce(sum(${caches.size}), 0)
			from ${caches}
			returning
				${cacheUsageSnapshots.cache_count} as "cacheCount",
				${cacheUsageSnapshots.total_size}::float8 as "totalSize"
		`);

		if (!snapshot) {
			throw new Error("failed to record cache usage");
		}

		const retained = tx
			.select({ id: cacheUsageSnapshots.id })
			.from(cacheUsageSnapshots)
			.orderBy(desc(cacheUsageSnapshots.id))
			.limit(CACHE_USAGE_SNAPSHOT_LIMIT);

		await tx.execute(
			sql`delete from ${cacheUsageSnapshots} where ${cacheUsageSnapshots.id} not in (${retained})`,
		);

		return { ...snapshot, recordedAt };
	});
}

/** List retained cache-usage snapshots from oldest to newest. */
export async function listCacheUsage(db: Db): Promise<CacheUsageSnapshot[]> {
	const rows = await db
		.select()
		.from(cacheUsageSnapshots)
		.orderBy(asc(cacheUsageSnapshots.recorded_at), asc(cacheUsageSnapshots.id));

	return rows.map((row) => ({
		cacheCount: row.cache_count,
		recordedAt: row.recorded_at,
		totalSize: row.total_size,
	}));
}
