import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { caches } from "../db/schema/caches";
import { cacheUsageSnapshots } from "../db/schema/cacheUsageSnapshots";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	CACHE_USAGE_SNAPSHOT_LIMIT,
	listCacheUsage,
	recordCacheUsage,
} from "./usage";

let database: TestDatabase;

beforeAll(async () => {
	database = await createTestDatabase();
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await database.db.delete(cacheUsageSnapshots);
	await database.db.delete(caches);
});

describe("recordCacheUsage", () => {
	it("records an empty cache store", async () => {
		const recordedAt = new Date("2026-09-11T12:00:00Z");

		await expect(recordCacheUsage(database.db, recordedAt)).resolves.toEqual({
			cacheCount: 0,
			recordedAt,
			totalSize: 0,
		});
	});

	it("records the cache count and total size", async () => {
		await database.db.insert(caches).values([
			{
				key: "first",
				storage_key: "caches/v1/first",
				params: {},
				size: 20,
				created_at: new Date("2026-09-11T10:00:00Z"),
				last_accessed_at: new Date("2026-09-11T10:00:00Z"),
			},
			{
				key: "second",
				storage_key: "caches/v1/second",
				params: {},
				size: 30,
				created_at: new Date("2026-09-11T11:00:00Z"),
				last_accessed_at: new Date("2026-09-11T11:00:00Z"),
			},
		]);

		await expect(recordCacheUsage(database.db)).resolves.toMatchObject({
			cacheCount: 2,
			totalSize: 50,
		});
	});

	it("retains only the newest 720 snapshots", async () => {
		const start = new Date("2026-08-12T12:00:00Z");
		await database.db.insert(cacheUsageSnapshots).values(
			Array.from({ length: CACHE_USAGE_SNAPSHOT_LIMIT }, (_, index) => ({
				recorded_at: new Date(start.getTime() + index * 60 * 60 * 1000),
				cache_count: index,
				total_size: index * 10,
			})),
		);

		const newest = new Date("2026-09-11T12:00:00Z");
		await recordCacheUsage(database.db, newest);

		const snapshots = await listCacheUsage(database.db);

		expect(snapshots).toHaveLength(CACHE_USAGE_SNAPSHOT_LIMIT);
		expect(snapshots[0]?.recordedAt).toEqual(
			new Date(start.getTime() + 60 * 60 * 1000),
		);
		expect(snapshots.at(-1)?.recordedAt).toEqual(newest);
	});
});

describe("listCacheUsage", () => {
	it("lists snapshots from oldest to newest", async () => {
		const older = new Date("2026-09-11T10:00:00Z");
		const newer = new Date("2026-09-11T11:00:00Z");

		await database.db.insert(cacheUsageSnapshots).values([
			{ recorded_at: newer, cache_count: 2, total_size: 30 },
			{ recorded_at: older, cache_count: 1, total_size: 20 },
		]);

		await expect(listCacheUsage(database.db)).resolves.toEqual([
			{ cacheCount: 1, recordedAt: older, totalSize: 20 },
			{ cacheCount: 2, recordedAt: newer, totalSize: 30 },
		]);
	});
});
