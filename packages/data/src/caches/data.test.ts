import { cacheKey, MemoryStorage } from "@virtool/storage";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db/pg";
import { caches } from "../db/schema/caches";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { testLogger } from "../test/logger";
import {
	CacheNotFoundError,
	CacheObjectMissingError,
	getCache,
	registerCache,
} from "./data";

let database: TestDatabase;
let db: Db;
const queries: string[] = [];

beforeAll(async () => {
	database = await createTestDatabase({
		onQuery: (query) => queries.push(query),
	});
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(caches);
	queries.length = 0;
});

const UUID_A = "0".repeat(32);
const UUID_B = "1".repeat(32);

async function* body(text: string): AsyncIterable<Uint8Array> {
	yield new TextEncoder().encode(text);
}

async function storageWith(
	entries: Record<string, string>,
): Promise<MemoryStorage> {
	const storage = new MemoryStorage();

	for (const [uuid, contents] of Object.entries(entries)) {
		await storage.write(cacheKey(uuid), body(contents));
	}

	return storage;
}

async function seedCache(overrides: Partial<typeof caches.$inferInsert> = {}) {
	const now = new Date();

	const [row] = await db
		.insert(caches)
		.values({
			key: "trimmed-reads:abc",
			storage_key: cacheKey(UUID_A),
			params: { sample_id: 1 },
			size: 12,
			created_at: now,
			last_accessed_at: now,
			...overrides,
		})
		.returning();

	if (!row) {
		throw new Error("failed to seed cache");
	}

	return row;
}

describe("getCache", () => {
	it("returns the row for a known key", async () => {
		const seeded = await seedCache();

		const row = await getCache(db, "trimmed-reads:abc");

		expect(row.id).toBe(seeded.id);
		expect(row.storage_key).toBe(cacheKey(UUID_A));
		expect(row.size).toBe(12);
		expect(row.params).toEqual({ sample_id: 1 });
	});

	it("throws CacheNotFoundError for an unknown key", async () => {
		await expect(getCache(db, "nothing-here")).rejects.toThrow(
			CacheNotFoundError,
		);
	});

	// Lookup is on the hot path of every workflow start, so a fresh row must not
	// cost a write.
	it("issues no update when last_accessed_at is fresh", async () => {
		await seedCache({
			last_accessed_at: new Date(Date.now() - 60 * 1000),
		});

		queries.length = 0;
		await getCache(db, "trimmed-reads:abc");

		expect(queries.some((query) => /update/i.test(query))).toBe(false);
	});

	it("refreshes last_accessed_at once it is older than five minutes", async () => {
		const stale = new Date(Date.now() - 6 * 60 * 1000);
		const seeded = await seedCache({ last_accessed_at: stale });

		const row = await getCache(db, "trimmed-reads:abc");

		expect(row.last_accessed_at.getTime()).toBeGreaterThan(stale.getTime());

		const [stored] = await db
			.select()
			.from(caches)
			.where(eq(caches.id, seeded.id));

		expect(stored?.last_accessed_at.getTime()).toBeGreaterThan(stale.getTime());
	});
});

describe("registerCache", () => {
	it("inserts a row keyed on the uuid the caller wrote under", async () => {
		const storage = await storageWith({ [UUID_A]: "hello world!" });

		const { row, created } = await registerCache(db, storage, testLogger, {
			key: "trimmed-reads:abc",
			uuid: UUID_A,
			params: { trim: true },
		});

		expect(created).toBe(true);
		expect(row.key).toBe("trimmed-reads:abc");
		expect(row.storage_key).toBe(cacheKey(UUID_A));
		expect(row.params).toEqual({ trim: true });
	});

	// The size on the row is what this side measured, so a caller cannot inflate
	// its own footprint or hide from Python's storage-budget accounting.
	it("stores the size read from storage", async () => {
		const storage = await storageWith({ [UUID_A]: "hello world!" });

		const { row } = await registerCache(db, storage, testLogger, {
			key: "trimmed-reads:abc",
			uuid: UUID_A,
			params: {},
		});

		expect(row.size).toBe(12);
	});

	it("writes no row when the uuid names no object", async () => {
		const storage = new MemoryStorage();

		await expect(
			registerCache(db, storage, testLogger, {
				key: "trimmed-reads:abc",
				uuid: UUID_A,
				params: {},
			}),
		).rejects.toThrow(CacheObjectMissingError);

		expect(await db.select().from(caches)).toEqual([]);
	});

	// Both workflows derived the same key and wrote the same bytes, so the loser
	// has nothing to report but success — pointed at the winner's blob.
	it("returns the winner's row to the loser of a key race", async () => {
		const storage = await storageWith({ [UUID_A]: "aaa", [UUID_B]: "aaa" });

		const winner = await registerCache(db, storage, testLogger, {
			key: "trimmed-reads:abc",
			uuid: UUID_A,
			params: { first: true },
		});

		const loser = await registerCache(db, storage, testLogger, {
			key: "trimmed-reads:abc",
			uuid: UUID_B,
			params: { second: true },
		});

		expect(loser.created).toBe(false);
		expect(loser.row.id).toBe(winner.row.id);
		expect(loser.row.storage_key).toBe(cacheKey(UUID_A));
		expect(loser.row.params).toEqual({ first: true });

		expect(await db.select().from(caches)).toHaveLength(1);
	});

	// An orphan has no row, so Python's LRU eviction — which walks rows — would
	// never reclaim it.
	it("deletes the loser's orphan and leaves the winner's object intact", async () => {
		const storage = await storageWith({ [UUID_A]: "aaa", [UUID_B]: "aaa" });

		await registerCache(db, storage, testLogger, {
			key: "trimmed-reads:abc",
			uuid: UUID_A,
			params: {},
		});

		await registerCache(db, storage, testLogger, {
			key: "trimmed-reads:abc",
			uuid: UUID_B,
			params: {},
		});

		await expect(storage.size(cacheKey(UUID_A))).resolves.toBe(3);
		await expect(storage.size(cacheKey(UUID_B))).rejects.toThrow();
	});

	it("both writers succeed when they register concurrently", async () => {
		const storage = await storageWith({ [UUID_A]: "aaa", [UUID_B]: "aaa" });

		const results = await Promise.all([
			registerCache(db, storage, testLogger, {
				key: "trimmed-reads:abc",
				uuid: UUID_A,
				params: {},
			}),
			registerCache(db, storage, testLogger, {
				key: "trimmed-reads:abc",
				uuid: UUID_B,
				params: {},
			}),
		]);

		expect(results.filter((result) => result.created)).toHaveLength(1);
		expect(new Set(results.map((result) => result.row.id)).size).toBe(1);
		expect(await db.select().from(caches)).toHaveLength(1);
	});

	// A retry re-selects the caller's *own* row, so the object it names is the
	// live one. Deleting it as if it were an orphan would strand the row on
	// nothing — a state no lookup can detect and no eviction repairs, since
	// eviction walks rows and this row still exists.
	it("keeps the object when a retry sends the same key and uuid", async () => {
		const storage = await storageWith({ [UUID_A]: "aaa" });

		const first = await registerCache(db, storage, testLogger, {
			key: "trimmed-reads:abc",
			uuid: UUID_A,
			params: {},
		});

		const retry = await registerCache(db, storage, testLogger, {
			key: "trimmed-reads:abc",
			uuid: UUID_A,
			params: {},
		});

		expect(retry.created).toBe(false);
		expect(retry.row.id).toBe(first.row.id);
		expect(retry.row.storage_key).toBe(cacheKey(UUID_A));

		await expect(storage.size(cacheKey(UUID_A))).resolves.toBe(3);
	});

	// `onConflictDoNothing` is targeted at `cache_key` specifically. A
	// `storage_key` collision can only mean a reused uuid, which is a bug, and
	// swallowing it would leave two logical caches sharing one object.
	it("raises on a storage_key collision rather than swallowing it", async () => {
		const storage = await storageWith({ [UUID_A]: "aaa" });

		await registerCache(db, storage, testLogger, {
			key: "trimmed-reads:abc",
			uuid: UUID_A,
			params: {},
		});

		await expect(
			registerCache(db, storage, testLogger, {
				key: "mapping-index:def",
				uuid: UUID_A,
				params: {},
			}),
		).rejects.toThrow(/storage_key/);
	});
});
