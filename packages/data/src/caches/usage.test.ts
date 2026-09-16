import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { caches } from "../db/schema/caches";
import { cacheUsageSnapshots } from "../db/schema/cacheUsageSnapshots";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { listCacheUsage, recordCacheUsage } from "./usage";

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

		await expect(recordCacheUsage(database.db, 1, recordedAt)).resolves.toEqual(
			{
				cacheCount: 0,
				recordedAt,
				totalSize: 0,
			},
		);
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

		await expect(recordCacheUsage(database.db, 1)).resolves.toMatchObject({
			cacheCount: 2,
			totalSize: 50,
		});
	});

	it("does not record the same task twice", async () => {
		const first = new Date("2026-09-11T11:00:00Z");
		const retry = new Date("2026-09-11T12:00:00Z");

		await recordCacheUsage(database.db, 1, first);
		await recordCacheUsage(database.db, 1, retry);

		const snapshots = await listCacheUsage(database.db);

		expect(snapshots).toEqual([
			{ cacheCount: 0, recordedAt: first, totalSize: 0 },
		]);
	});

	it("expires snapshots older than 30 days", async () => {
		const recordedAt = new Date("2026-09-11T12:00:00Z");
		await database.db.insert(cacheUsageSnapshots).values([
			{
				task_id: 1,
				recorded_at: new Date("2026-08-12T11:59:59Z"),
				cache_count: 1,
				total_size: 10,
			},
			{
				task_id: 2,
				recorded_at: new Date("2026-08-12T12:00:00Z"),
				cache_count: 2,
				total_size: 20,
			},
		]);

		await recordCacheUsage(database.db, 3, recordedAt);

		await expect(listCacheUsage(database.db)).resolves.toEqual([
			{
				cacheCount: 2,
				recordedAt: new Date("2026-08-12T12:00:00Z"),
				totalSize: 20,
			},
			{ cacheCount: 0, recordedAt, totalSize: 0 },
		]);
	});
});

describe("listCacheUsage", () => {
	it("lists snapshots from oldest to newest", async () => {
		const older = new Date("2026-09-11T10:00:00Z");
		const newer = new Date("2026-09-11T11:00:00Z");

		await database.db.insert(cacheUsageSnapshots).values([
			{ task_id: 2, recorded_at: newer, cache_count: 2, total_size: 30 },
			{ task_id: 1, recorded_at: older, cache_count: 1, total_size: 20 },
		]);

		await expect(listCacheUsage(database.db)).resolves.toEqual([
			{ cacheCount: 1, recordedAt: older, totalSize: 20 },
			{ cacheCount: 2, recordedAt: newer, totalSize: 30 },
		]);
	});
});
