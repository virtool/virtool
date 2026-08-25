import type { Db } from "@virtool/data/db/pg";
import { caches } from "@virtool/data/db/schema/caches";
import { tasks } from "@virtool/data/db/schema/tasks";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { createLogger, type Logger } from "@virtool/logger";
import type { StorageBackend } from "@virtool/storage";
import { cacheKey, MemoryStorage } from "@virtool/storage";
import { asc } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runTask } from "../framework/run";
import { claimTask, readTaskRow } from "../testing/tasks";
import { evictCachesLruTask } from "./evict-caches-lru";
import type { TaskContext } from "./registry";

const GIB = 1024 ** 3;

const logger: Logger = createLogger({ name: "test", level: "silent" });

let database: TestDatabase;
let db: Db;
let storage: MemoryStorage;
let ctx: TaskContext;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(caches);
	await db.delete(tasks);

	storage = new MemoryStorage();
	ctx = { db, storage };
});

async function* body(text: string): AsyncIterable<Uint8Array> {
	yield new TextEncoder().encode(text);
}

/**
 * Seed `count` cache entries of `size` declared bytes each, oldest first.
 *
 * The declared `size` is a column rather than a measurement, so a store that
 * reads as hundreds of gigabytes — enough to press against the hardcoded
 * budget the body passes — costs a handful of bytes of real object storage.
 */
async function seedEntries(count: number, size: number): Promise<string[]> {
	const keys: string[] = [];

	for (let index = 0; index < count; index++) {
		const storageKey = cacheKey(index.toString(16).padStart(32, "0"));
		const key = `cache-${index}`;

		await storage.write(storageKey, body(key));

		// Descending age, so index 0 is the least recently used and eviction order
		// is the seeding order.
		const accessed = new Date(Date.now() - (count - index) * 60 * 60 * 1000);

		await db.insert(caches).values({
			key,
			storage_key: storageKey,
			params: {},
			size,
			created_at: accessed,
			last_accessed_at: accessed,
		});

		keys.push(key);
	}

	return keys;
}

async function remainingKeys(): Promise<string[]> {
	const rows = await db
		.select({ key: caches.key })
		.from(caches)
		.orderBy(asc(caches.last_accessed_at), asc(caches.id));

	return rows.map((row) => row.key);
}

/** A backend that answers reads from `storage` but refuses every delete. */
function refusingDeletes(): StorageBackend {
	return {
		read: (key) => storage.read(key),
		write: (key, data) => storage.write(key, data),
		list: (prefix) => storage.list(prefix),
		size: (key) => storage.size(key),
		delete: async () => {
			throw new Error("bucket refused the delete");
		},
	};
}

describe("evictCachesLruTask", () => {
	it("completes without evicting when the store is under budget", async () => {
		const keys = await seedEntries(5, 10 * GIB);

		const task = await claimTask(db, evictCachesLruTask);

		const outcome = await runTask({
			db,
			def: evictCachesLruTask,
			task,
			ctx,
			logger,
			signal: new AbortController().signal,
		});

		expect(outcome).toEqual({ status: "completed" });

		expect(await readTaskRow(db, task.id)).toMatchObject({
			complete: true,
			error: null,
			progress: 100,
			step: "evict",
		});

		expect(await remainingKeys()).toEqual(keys);
	});

	// 150 GiB stored against the hardcoded 100 GiB budget, so 50 GiB has to go and
	// the five least recently used entries are what covers it.
	it("evicts the least recently used entries once the store is over budget", async () => {
		const keys = await seedEntries(15, 10 * GIB);

		const task = await claimTask(db, evictCachesLruTask);

		const outcome = await runTask({
			db,
			def: evictCachesLruTask,
			task,
			ctx,
			logger,
			signal: new AbortController().signal,
		});

		expect(outcome).toEqual({ status: "completed" });
		expect(await remainingKeys()).toEqual(keys.slice(5));

		await expect(
			storage.size(cacheKey("0".padStart(32, "0"))),
		).rejects.toThrow();
	});

	it("fails the task and leaves every row when storage refuses a delete", async () => {
		const keys = await seedEntries(15, 10 * GIB);

		const task = await claimTask(db, evictCachesLruTask);

		const outcome = await runTask({
			db,
			def: evictCachesLruTask,
			task,
			ctx: { db, storage: refusingDeletes() },
			logger,
			signal: new AbortController().signal,
		});

		expect(outcome).toEqual({
			status: "failed",
			error: "Error: bucket refused the delete",
		});

		expect(await readTaskRow(db, task.id)).toMatchObject({
			complete: true,
			error: "Error: bucket refused the delete",
		});

		expect(await remainingKeys()).toEqual(keys);
	});

	// Nothing interrupts a body on its own: `runTask` awaits it. A run left to
	// walk hundreds of objects would hold the drain open for as long as that
	// takes, and could reach the row delete after the claim was released.
	it("stops deleting and leaves every row when the run is aborted", async () => {
		const keys = await seedEntries(20, 10 * GIB);

		const controller = new AbortController();

		let started = 0;
		let settled = 0;

		// Ten candidates against a concurrency of eight, so the abort raised inside
		// the first wave's deletes is seen by the workers that go back for the rest.
		// Each delete takes long enough that one abandoned mid-flight would still be
		// running when the run reports its outcome.
		const aborting: StorageBackend = {
			read: (key) => storage.read(key),
			write: (key, data) => storage.write(key, data),
			list: (prefix) => storage.list(prefix),
			size: (key) => storage.size(key),
			delete: async (key) => {
				started++;
				controller.abort();

				await new Promise((resolve) => setTimeout(resolve, 100));
				await storage.delete(key);

				settled++;
			},
		};

		const task = await claimTask(db, evictCachesLruTask);

		const outcome = await runTask({
			db,
			def: evictCachesLruTask,
			task,
			ctx: { db, storage: aborting },
			logger,
			signal: controller.signal,
		});

		expect(outcome).toEqual({ status: "aborted" });

		// An abort raised out of one worker must not abandon the deletes its
		// siblings still have in flight: the run cannot report itself quiesced with
		// work still moving behind it.
		expect(started).toBeGreaterThan(0);
		expect(settled).toBe(started);

		// The row is left exactly as it stands, for the runner to release.
		expect(await readTaskRow(db, task.id)).toMatchObject({
			complete: false,
			error: null,
		});

		expect(await remainingKeys()).toEqual(keys);
	});
});
