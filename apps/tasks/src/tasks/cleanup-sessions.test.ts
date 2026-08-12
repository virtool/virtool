import { seedSession, seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { sessions } from "@virtool/data/db/schema/sessions";
import { tasks } from "@virtool/data/db/schema/tasks";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { acquireTask, type ClaimedTask } from "@virtool/data/tasks/data";
import { createLogger, type Logger } from "@virtool/logger";
import { MemoryStorage } from "@virtool/storage";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runTask } from "../framework/run";
import { cleanupSessionsTask } from "./cleanup-sessions";
import type { TaskContext } from "./registry";

const RUNNER = "ts-runner-a-1";

const logger: Logger = createLogger({ name: "test", level: "silent" });

let database: TestDatabase;
let db: Db;
let ctx: TaskContext;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(sessions);
	await db.delete(users);
	await db.delete(tasks);

	ctx = { db, storage: new MemoryStorage() };
});

function minutesFromNow(minutes: number): Date {
	return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Insert a `cleanup_sessions` row and claim it, as the spawner and the runner
 * will once the cutover registers it.
 *
 * Written directly rather than through `createTask`, whose `TaskType` lists only
 * the four the web app spawns.
 */
async function claim(): Promise<ClaimedTask> {
	await db.insert(tasks).values({
		complete: false,
		context: {},
		count: 0,
		created_at: new Date(),
		progress: 0,
		step: cleanupSessionsTask.type,
		type: cleanupSessionsTask.type,
	});

	const claimed = await acquireTask(db, {
		runnerId: RUNNER,
		allowedTypes: [cleanupSessionsTask.type],
	});

	if (claimed === null) {
		throw new Error("the task under test was not claimable");
	}

	return claimed;
}

function readRow(taskId: number) {
	return db
		.select()
		.from(tasks)
		.where(eq(tasks.id, taskId))
		.then(([row]) => row);
}

async function remainingSessionIds(): Promise<string[]> {
	const rows = await db
		.select({ sessionId: sessions.sessionId })
		.from(sessions)
		.orderBy(sessions.id);

	return rows.map((row) => row.sessionId);
}

describe("cleanupSessionsTask", () => {
	it("deletes the expired sessions and completes", async () => {
		const userId = await seedUser(db);

		await seedSession(db, userId, { expiresAt: minutesFromNow(-30) });
		await seedSession(db, userId, { expiresAt: minutesFromNow(-1) });
		const live = await seedSession(db, userId, {
			expiresAt: minutesFromNow(30),
		});

		const task = await claim();

		const outcome = await runTask({
			db,
			def: cleanupSessionsTask,
			task,
			ctx,
			logger,
			signal: new AbortController().signal,
		});

		expect(outcome).toEqual({ status: "completed" });

		expect(await readRow(task.id)).toMatchObject({
			complete: true,
			error: null,
			progress: 100,
			step: "cleanup_expired_sessions",
		});

		expect(await remainingSessionIds()).toEqual([live.sessionId]);
	});

	it("completes without deleting when nothing has expired", async () => {
		const userId = await seedUser(db);
		const live = await seedSession(db, userId, {
			expiresAt: minutesFromNow(30),
		});

		const task = await claim();

		const outcome = await runTask({
			db,
			def: cleanupSessionsTask,
			task,
			ctx,
			logger,
			signal: new AbortController().signal,
		});

		expect(outcome).toEqual({ status: "completed" });

		expect(await readRow(task.id)).toMatchObject({
			complete: true,
			error: null,
			progress: 100,
		});

		expect(await remainingSessionIds()).toEqual([live.sessionId]);
	});
});
