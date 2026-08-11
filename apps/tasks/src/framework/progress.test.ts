import type { Db } from "@virtool/data/db/pg";
import { tasks } from "@virtool/data/db/schema/tasks";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { createTask } from "@virtool/data/tasks/data";
import { createLogger, type Logger } from "@virtool/logger";
import { eq } from "drizzle-orm";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	createProgressWriter,
	PROGRESS_DEBOUNCE_MS,
	roundHalfToEven,
} from "./progress";

const RUNNER_A = "ts-runner-a-1";
const RUNNER_B = "ts-runner-b-2";

/** Long enough that no test's debounce window closes on its own. */
const NEVER_FIRES_MS = 60_000;

const logger: Logger = createLogger({ name: "test", level: "silent" });

let database: TestDatabase;
let db: Db;
let queries: string[] = [];

beforeAll(async () => {
	database = await createTestDatabase({
		onQuery: (query) => {
			queries.push(query);
		},
	});
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(tasks);
	queries = [];
});

/** How many `UPDATE`s of the `tasks` table the connection has sent so far. */
function countUpdates(): number {
	return queries.filter((query) => query.includes('update "tasks"')).length;
}

async function readRow(taskId: number) {
	const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId));

	if (row === undefined) {
		throw new Error(`no task row with id ${taskId}`);
	}

	return row;
}

/** Insert a task and put it in the state a runner holding a live lease leaves. */
async function heldTask(runnerId: string): Promise<number> {
	const taskId = await createTask(db, "install_hmms");

	await db
		.update(tasks)
		.set({ acquired_at: new Date(), runner_id: runnerId })
		.where(eq(tasks.id, taskId));

	queries = [];

	return taskId;
}

describe("roundHalfToEven", () => {
	it("breaks a tie to the even side, as Python's round does", () => {
		expect(roundHalfToEven(62.5)).toBe(62);
		expect(roundHalfToEven(12.5)).toBe(12);
		expect(roundHalfToEven(63.5)).toBe(64);
		expect(roundHalfToEven(37.5)).toBe(38);
	});

	it("rounds to the nearer integer otherwise", () => {
		expect(roundHalfToEven(0.4)).toBe(0);
		expect(roundHalfToEven(0.6)).toBe(1);
		expect(roundHalfToEven(66.67)).toBe(67);
		expect(roundHalfToEven(50)).toBe(50);
	});
});

describe("createProgressWriter", () => {
	it("debounces on a 250 ms window by default", () => {
		expect(PROGRESS_DEBOUNCE_MS).toBe(250);
	});

	it("collapses a burst of writes into one, and flush lands the last value", async () => {
		const taskId = await heldTask(RUNNER_A);

		const writer = createProgressWriter({
			db,
			taskId,
			runnerId: RUNNER_A,
			logger,
			debounceMs: NEVER_FIRES_MS,
		});

		for (let value = 1; value <= 20; value += 1) {
			writer.set({ progress: value });
		}

		expect(countUpdates()).toBe(0);

		await writer.flush();

		expect(countUpdates()).toBe(1);
		expect((await readRow(taskId)).progress).toBe(20);
	});

	it("ignores a decrease rather than writing it", async () => {
		const taskId = await heldTask(RUNNER_A);

		const writer = createProgressWriter({
			db,
			taskId,
			runnerId: RUNNER_A,
			logger,
			debounceMs: NEVER_FIRES_MS,
		});

		writer.set({ progress: 90 });
		await writer.flush();

		writer.set({ progress: 40 });
		await writer.flush();

		expect(countUpdates()).toBe(1);
		expect((await readRow(taskId)).progress).toBe(90);
	});

	it("measures a decrease from the progress already on the row", async () => {
		const taskId = await heldTask(RUNNER_A);

		await db.update(tasks).set({ progress: 87 }).where(eq(tasks.id, taskId));

		const writer = createProgressWriter({
			db,
			taskId,
			runnerId: RUNNER_A,
			logger,
			progress: 87,
			debounceMs: NEVER_FIRES_MS,
		});

		await writer.setNow({ progress: 0, step: "one" });

		expect(await readRow(taskId)).toMatchObject({ progress: 87, step: "one" });
	});

	it("writes a step change even when progress stands still", async () => {
		const taskId = await heldTask(RUNNER_A);

		const writer = createProgressWriter({
			db,
			taskId,
			runnerId: RUNNER_A,
			logger,
			debounceMs: NEVER_FIRES_MS,
		});

		await writer.setNow({ progress: 25, step: "one" });
		await writer.setNow({ progress: 25, step: "two" });

		expect(countUpdates()).toBe(2);
		expect(await readRow(taskId)).toMatchObject({ progress: 25, step: "two" });
	});

	it("writes nothing when nothing moved", async () => {
		const taskId = await heldTask(RUNNER_A);

		const writer = createProgressWriter({
			db,
			taskId,
			runnerId: RUNNER_A,
			logger,
			debounceMs: NEVER_FIRES_MS,
		});

		await writer.setNow({ progress: 25, step: "one" });
		await writer.setNow({ progress: 25, step: "one" });

		expect(countUpdates()).toBe(1);
	});

	it("supersedes a pending write rather than writing both", async () => {
		const taskId = await heldTask(RUNNER_A);

		const writer = createProgressWriter({
			db,
			taskId,
			runnerId: RUNNER_A,
			logger,
			debounceMs: NEVER_FIRES_MS,
		});

		writer.set({ progress: 10 });
		await writer.setNow({ progress: 50 });

		expect(countUpdates()).toBe(1);
		expect((await readRow(taskId)).progress).toBe(50);
	});

	it("closes the window on its own once the debounce elapses", async () => {
		const taskId = await heldTask(RUNNER_A);

		const writer = createProgressWriter({
			db,
			taskId,
			runnerId: RUNNER_A,
			logger,
			debounceMs: 5,
		});

		writer.set({ progress: 33 });

		await vi.waitFor(async () => {
			expect((await readRow(taskId)).progress).toBe(33);
		});
	});

	it("stops writing once a write finds the task held by another runner", async () => {
		const taskId = await heldTask(RUNNER_B);

		const writer = createProgressWriter({
			db,
			taskId,
			runnerId: RUNNER_A,
			logger,
			debounceMs: NEVER_FIRES_MS,
		});

		await writer.setNow({ progress: 10 });

		expect(writer.isFenced()).toBe(true);
		expect(countUpdates()).toBe(1);

		writer.set({ progress: 20 });
		await writer.setNow({ progress: 30 });
		await writer.flush();

		expect(countUpdates()).toBe(1);
		expect((await readRow(taskId)).progress).toBe(0);
	});
});
