import { seedSession, seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { sessions } from "@virtool/data/db/schema/sessions";
import { tasks } from "@virtool/data/db/schema/tasks";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { createLogger, type Logger } from "@virtool/logger";
import { MemoryStorage } from "@virtool/storage";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runTask } from "../framework/run";
import { claimTask, readTaskRow } from "../testing/tasks";
import { cleanupSessionsTask } from "./cleanup-sessions";
import type { TaskContext } from "./registry";

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

		const task = await claimTask(db, cleanupSessionsTask);

		const outcome = await runTask({
			db,
			def: cleanupSessionsTask,
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
			step: "cleanup_expired_sessions",
		});

		expect(await remainingSessionIds()).toEqual([live.sessionId]);
	});

	it("completes without deleting when nothing has expired", async () => {
		const userId = await seedUser(db);
		const live = await seedSession(db, userId, {
			expiresAt: minutesFromNow(30),
		});

		const task = await claimTask(db, cleanupSessionsTask);

		const outcome = await runTask({
			db,
			def: cleanupSessionsTask,
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
		});

		expect(await remainingSessionIds()).toEqual([live.sessionId]);
	});
});
