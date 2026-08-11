import type { Db } from "@virtool/data/db/pg";
import { tasks } from "@virtool/data/db/schema/tasks";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTaskQueueReader } from "./queue";

let database: TestDatabase;
let db: Db;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(tasks);
});

async function seedQueuedTask(type: string, ageSeconds = 0): Promise<void> {
	await db.insert(tasks).values({
		complete: false,
		context: {},
		count: 0,
		created_at: new Date(Date.now() - ageSeconds * 1000),
		progress: 0,
		step: type,
		type,
	});
}

describe("createTaskQueueReader", () => {
	it("reads counts and ages together", async () => {
		await seedQueuedTask("install_hmms", 300);

		const snapshot = await createTaskQueueReader(db)();

		expect(snapshot.counts).toEqual([
			{ type: "install_hmms", queued: 1, running: 0 },
		]);
		expect(snapshot.oldestQueuedAges).toHaveLength(1);
		expect(snapshot.oldestQueuedAges[0]?.ageSeconds).toBeGreaterThanOrEqual(
			300,
		);
	});

	// Two Prometheus replicas, or a human curling in a loop, would otherwise
	// multiply the scan across the pool this process claims tasks over.
	it("does not re-query inside its TTL", async () => {
		await seedQueuedTask("install_hmms");

		let clock = 0;
		const read = createTaskQueueReader(db, { ttlMs: 10_000, now: () => clock });

		expect(await read()).toEqual(await read());

		await seedQueuedTask("install_hmms");
		clock = 9_999;

		expect((await read()).counts).toEqual([
			{ type: "install_hmms", queued: 1, running: 0 },
		]);

		clock = 10_000;

		expect((await read()).counts).toEqual([
			{ type: "install_hmms", queued: 2, running: 0 },
		]);
	});

	// A cache keyed only on the last settled result would let two scrapes
	// arriving together each open their own query.
	it("shares an in-flight read between concurrent callers", async () => {
		await seedQueuedTask("install_hmms");

		const read = createTaskQueueReader(db);
		const [first, second] = await Promise.all([read(), read()]);

		expect(first).toBe(second);
	});

	// Holding a failure for the full TTL would keep these series dark for ten
	// seconds past a blip that lasted one.
	it("does not cache a failed read", async () => {
		const broken = new Proxy(
			{},
			{
				get() {
					throw new Error("postgres is down");
				},
			},
		) as Db;

		const read = createTaskQueueReader(broken);

		await expect(read()).rejects.toThrow("postgres is down");
		await expect(read()).rejects.toThrow("postgres is down");
	});
});
