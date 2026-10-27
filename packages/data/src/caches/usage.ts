import type { CacheUsageSnapshot } from "@virtool/contracts";
import { asc, sql } from "drizzle-orm";
import type { Db } from "../db/pg";
import { caches } from "../db/schema/caches";
import { cacheUsageSnapshots } from "../db/schema/cacheUsageSnapshots";

const CACHE_USAGE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Record current aggregate cache usage once per task and expire old snapshots. */
export async function recordCacheUsage(
	db: Db,
	taskId: number,
	recordedAt: Date = new Date(),
): Promise<CacheUsageSnapshot> {
	const cutoff = new Date(recordedAt.getTime() - CACHE_USAGE_RETENTION_MS);

	return db.transaction(async (tx) => {
		const [snapshot] = await tx.execute<
			Pick<CacheUsageSnapshot, "cacheCount" | "totalSize"> & {
				recordedAt: string;
			}
		>(sql`
			insert into ${cacheUsageSnapshots} (task_id, recorded_at, cache_count, total_size)
			select
				${taskId},
				${sql.param(recordedAt, cacheUsageSnapshots.recorded_at)},
				count(*)::int,
				coalesce(sum(${caches.size}), 0)
			from ${caches}
			on conflict (task_id) do update
			set task_id = excluded.task_id
			returning
				${cacheUsageSnapshots.recorded_at} as "recordedAt",
				${cacheUsageSnapshots.cache_count} as "cacheCount",
				${cacheUsageSnapshots.total_size}::float8 as "totalSize"
		`);

		if (!snapshot) {
			throw new Error("failed to record cache usage");
		}

		await tx.execute(
			sql`delete from ${cacheUsageSnapshots}
				where ${cacheUsageSnapshots.recorded_at} < ${sql.param(cutoff, cacheUsageSnapshots.recorded_at)}`,
		);

		return { ...snapshot, recordedAt: new Date(snapshot.recordedAt) };
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
