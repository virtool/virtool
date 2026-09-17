import { seedSession, seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { authSessions } from "@virtool/data/db/schema/auth";
import { tasks } from "@virtool/data/db/schema/tasks";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { createLogger, type Logger } from "@virtool/logger";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runTask } from "../framework/run";
import {
	claimTask,
	createTaskTestContext,
	readTaskRow,
} from "../testing/tasks";
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
	await db.delete(authSessions);
	await db.delete(users);
	await db.delete(tasks);
	ctx = createTaskTestContext({ db });
});

describe("cleanupSessionsTask", () => {
	it("deletes expired sessions and completes", async () => {
		const userId = await seedUser(db);
		await seedSession(db, userId, {
			expiresAt: new Date(Date.now() - 60_000),
		});
		const live = await seedSession(db, userId);
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
		expect(await db.select({ id: authSessions.id }).from(authSessions)).toEqual(
			[{ id: live.sessionId }],
		);
	});
});
