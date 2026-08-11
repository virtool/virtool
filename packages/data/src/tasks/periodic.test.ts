import { setTimeout as delay } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	onTestFinished,
} from "vitest";

import type { Db, PgClient } from "../db/pg";
import { tasks } from "../db/schema/tasks";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { collectFrames } from "../test/frames";
import { createPeriodicTask } from "./data";

let database: TestDatabase;
let db: Db;

/** Every statement the fixture's connection has sent since the last reset. */
let statements: string[] = [];

beforeAll(async () => {
	database = await createTestDatabase({
		onQuery: (query) => {
			statements.push(query);
		},
	});

	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(tasks);

	statements = [];
});

/**
 * Insert a row of `type` that was created `ageSeconds` ago, the way Python
 * writes one: a naive UTC `created_at`, computed by Postgres.
 */
async function seedTask(
	type: string,
	ageSeconds: number,
	values: { complete?: boolean; error?: string } = {},
): Promise<number> {
	const [row] = await db
		.insert(tasks)
		.values({
			complete: values.complete ?? false,
			context: {},
			count: 0,
			created_at: sql`timezone('utc', clock_timestamp()) - make_interval(secs => ${ageSeconds}::double precision)`,
			error: values.error ?? null,
			progress: 0,
			step: type,
			type,
		})
		.returning({ id: tasks.id });

	if (row === undefined) {
		throw new Error("failed to seed a task");
	}

	return row.id;
}

async function countTasks(type: string): Promise<number> {
	const rows = await db
		.select({ id: tasks.id })
		.from(tasks)
		.where(eq(tasks.type, type));

	return rows.length;
}

/** A transaction held open by a test, and the way to let it commit. */
type HeldTransaction = { release: () => Promise<void> };

/**
 * Hold the advisory lock Python's spawner takes, from a session of its own.
 *
 * The statement is written out as a literal rather than reusing anything the
 * implementation under test builds, because the point is to prove the two
 * *independently* agree on the key. `hashtext` of the bare task name, the
 * single-argument transaction-scoped form: exactly what
 * `func.pg_try_advisory_xact_lock(func.hashtext(task_class.name))` emits.
 */
async function holdPythonLock(
	client: PgClient,
	type: string,
): Promise<HeldTransaction> {
	let open: () => void = () => undefined;
	const released = new Promise<void>((resolve) => {
		open = resolve;
	});

	let acquired: (locked: boolean) => void = () => undefined;
	const taken = new Promise<boolean>((resolve) => {
		acquired = resolve;
	});

	const held = client.begin(async (tx) => {
		const rows = await tx.unsafe(
			`select pg_try_advisory_xact_lock(hashtext('${type}')) as locked`,
		);

		acquired(rows[0]?.locked === true);

		await released;
	});

	expect(await taken).toBe(true);

	return {
		release: async () => {
			open();
			await held;
		},
	};
}

describe("createPeriodicTask", () => {
	it("inserts a pending task when nothing of the type is in the window", async () => {
		const result = await createPeriodicTask(db, "sweep_blast", 30);

		expect(result.outcome).toBe("spawned");
		expect(result.task).toMatchObject({
			complete: false,
			error: null,
			progress: 0,
			step: "sweep_blast",
			type: "sweep_blast",
		});

		expect(await countTasks("sweep_blast")).toBe(1);
	});

	it("emits Python's advisory lock statement", async () => {
		await createPeriodicTask(db, "sweep_blast", 30);

		// Read off the wire rather than off the TypeScript. The single-argument
		// form, `hashtext` computed in SQL, and the bare name as the parameter are
		// each what makes this exclude Python's spawner; a hash computed here or
		// the two-argument form would key a different lock and read the same in
		// the source.
		expect(
			statements.filter((statement) =>
				statement.includes("pg_try_advisory_xact_lock"),
			),
		).toEqual([
			expect.stringContaining(
				"select pg_try_advisory_xact_lock(hashtext($1)) as locked",
			),
		]);
	});

	it("publishes a create frame once the transaction has committed", async () => {
		let spawnedId: number | undefined;

		// The suppressed spawn is what makes this an assertion of *one* frame
		// rather than of at least one: it runs before the sentinel, so a frame
		// from a spawn that did not happen would have arrived by the time this
		// resolves.
		const frames = await collectFrames(database.client, async () => {
			const spawned = await createPeriodicTask(db, "sweep_blast", 30);
			const suppressed = await createPeriodicTask(db, "sweep_blast", 30);

			expect(suppressed.outcome).toBe("not_due");

			spawnedId = spawned.task?.id;
		});

		expect(frames).toEqual([
			{ domain: "tasks", resource_id: spawnedId, operation: "create" },
		]);
	});
});

describe("the recency window", () => {
	it("suppresses a spawn when a task of the type is inside it", async () => {
		await seedTask("sweep_blast", 10);

		const result = await createPeriodicTask(db, "sweep_blast", 30);

		expect(result).toEqual({ outcome: "not_due", task: null });
		expect(await countTasks("sweep_blast")).toBe(1);
	});

	it("spawns when the newest task of the type is older than it", async () => {
		await seedTask("sweep_blast", 31);

		const result = await createPeriodicTask(db, "sweep_blast", 30);

		expect(result.outcome).toBe("spawned");
		expect(await countTasks("sweep_blast")).toBe(2);
	});

	it("ignores tasks of other types", async () => {
		await seedTask("refresh_hmms", 1);

		const result = await createPeriodicTask(db, "sweep_blast", 30);

		expect(result.outcome).toBe("spawned");
	});

	// Python selects any row of the type inside the window, whatever its state.
	// A stricter rule here would lose to Python's looser one every time the two
	// spawners raced, which is the duplicate the advisory lock exists to prevent.
	it("counts a completed task inside it", async () => {
		await seedTask("sweep_blast", 10, { complete: true });

		expect(await createPeriodicTask(db, "sweep_blast", 30)).toEqual({
			outcome: "not_due",
			task: null,
		});
	});

	it("counts an errored task inside it", async () => {
		await seedTask("sweep_blast", 10, { error: "boom" });

		expect(await createPeriodicTask(db, "sweep_blast", 30)).toEqual({
			outcome: "not_due",
			task: null,
		});
	});

	/**
	 * The columns are naive UTC and nothing sets the session `TimeZone`, so a
	 * window built from a `timestamptz` — a JavaScript `Date`, or `now()` — would
	 * be compared through whatever zone the session happens to carry. This runs
	 * the whole thing under a session eight hours off UTC: an implementation with
	 * that bug reads the ten-second-old row as hours old and spawns.
	 */
	it("compares in UTC whatever the session time zone is", async () => {
		const skewed = database.connect();

		onTestFinished(async () => {
			await skewed.close();
		});

		await skewed.client.unsafe("set time zone 'America/Vancouver'");

		await seedTask("sweep_blast", 10);

		expect(await createPeriodicTask(skewed.db, "sweep_blast", 30)).toEqual({
			outcome: "not_due",
			task: null,
		});

		await db.delete(tasks);
		await seedTask("sweep_blast", 31);

		expect(
			(await createPeriodicTask(skewed.db, "sweep_blast", 30)).outcome,
		).toBe("spawned");
	});
});

describe("mutual exclusion", () => {
	/**
	 * The regression guard for the whole issue. One participant is raw SQL
	 * matching what Python emits, so this exercises the cross-implementation
	 * exclusion without needing a Python process — and it fails if the key is
	 * namespaced, hashed client-side, or built with the two-argument form, none
	 * of which a TypeScript-only test would notice.
	 */
	it("is blocked by a lock Python's spawner would hold", async () => {
		const python = database.connect();

		onTestFinished(async () => {
			await python.close();
		});

		const held = await holdPythonLock(python.client, "sweep_blast");

		expect(await createPeriodicTask(db, "sweep_blast", 30)).toEqual({
			outcome: "skipped_locked",
			task: null,
		});

		expect(await countTasks("sweep_blast")).toBe(0);

		// The lock is per task name: the other four are untouched by it.
		for (const type of [
			"refresh_hmms",
			"timeout_jobs",
			"evict_caches_lru",
			"reap_orphaned_uploads",
		] as const) {
			expect((await createPeriodicTask(db, type, 600)).outcome).toBe("spawned");
		}

		await held.release();

		expect((await createPeriodicTask(db, "sweep_blast", 30)).outcome).toBe(
			"spawned",
		);
	});

	/**
	 * The same key, checked at the Postgres level rather than by its effect.
	 *
	 * The lock is transaction-scoped, so seeing it in `pg_locks` means catching
	 * the transaction open: another session takes a table lock the insert
	 * conflicts with, which parks the spawner between taking the advisory lock
	 * and committing.
	 */
	it("takes the lock Postgres reports as hashtext of the bare name", async () => {
		const blocker = database.connect();
		const observer = database.connect();

		onTestFinished(async () => {
			await Promise.all([blocker.close(), observer.close()]);
		});

		let open: () => void = () => undefined;
		const released = new Promise<void>((resolve) => {
			open = resolve;
		});

		let taken: () => void = () => undefined;
		const locked = new Promise<void>((resolve) => {
			taken = resolve;
		});

		// SHARE conflicts with the ROW EXCLUSIVE an INSERT takes, and not with the
		// ACCESS SHARE of the recency read.
		const blocking = blocker.client.begin(async (tx) => {
			await tx.unsafe("lock table tasks in share mode");

			taken();

			await released;
		});

		await locked;

		const pending = createPeriodicTask(db, "sweep_blast", 30);

		const [expected] = await observer.client.unsafe(
			`select
				(hashtext('sweep_blast')::bigint >> 32) & 4294967295 as classid,
				hashtext('sweep_blast')::bigint & 4294967295 as objid`,
		);

		let advisory: { classid: number; objid: number } | undefined;

		for (let attempt = 0; attempt < 200 && advisory === undefined; attempt++) {
			const rows = await observer.client.unsafe(
				`select classid, objid from pg_locks
				 where locktype = 'advisory'
				 and database = (select oid from pg_database where datname = current_database())`,
			);

			if (rows.length > 0) {
				advisory = {
					classid: Number(rows[0]?.classid),
					objid: Number(rows[0]?.objid),
				};

				break;
			}

			await delay(25);
		}

		open();
		await blocking;

		expect((await pending).outcome).toBe("spawned");

		expect(advisory).toEqual({
			classid: Number(expected?.classid),
			objid: Number(expected?.objid),
		});
	});

	/**
	 * Two spawners, genuinely concurrent on separate connections. Repeated,
	 * because an interleaving that only sometimes loses is exactly the bug this
	 * is here to catch.
	 */
	it("lets exactly one of two racing spawners insert", async () => {
		const other = database.connect();

		onTestFinished(async () => {
			await other.close();
		});

		for (let round = 0; round < 10; round++) {
			await db.delete(tasks);

			const results = await Promise.all([
				createPeriodicTask(db, "sweep_blast", 30),
				createPeriodicTask(other.db, "sweep_blast", 30),
			]);

			expect(
				results.filter(({ outcome }) => outcome === "spawned"),
			).toHaveLength(1);

			expect(await countTasks("sweep_blast")).toBe(1);
		}
	});
});
