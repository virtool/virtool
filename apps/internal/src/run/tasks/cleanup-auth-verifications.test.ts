import type { Db } from "@virtool/data/db/pg";
import { authVerifications } from "@virtool/data/db/schema/auth";
import { tasks } from "@virtool/data/db/schema/tasks";
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
import { cleanupAuthVerificationsTask } from "./cleanup-auth-verifications";
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
	await db.delete(authVerifications);
	await db.delete(tasks);
	ctx = createTaskTestContext({ db });
});

describe("cleanupAuthVerificationsTask", () => {
	it("deletes expired verifications and completes", async () => {
		const now = new Date();
		const [, live] = await db
			.insert(authVerifications)
			.values([
				{
					identifier: "expired",
					value: "value",
					expiresAt: new Date(now.getTime() - 60_000),
					createdAt: now,
					updatedAt: now,
				},
				{
					identifier: "live",
					value: "value",
					expiresAt: new Date(now.getTime() + 300_000),
					createdAt: now,
					updatedAt: now,
				},
			])
			.returning({ id: authVerifications.id });
		const task = await claimTask(db, cleanupAuthVerificationsTask);

		const outcome = await runTask({
			db,
			def: cleanupAuthVerificationsTask,
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
			step: "cleanup_expired_verifications",
		});
		expect(
			await db.select({ id: authVerifications.id }).from(authVerifications),
		).toEqual([live]);
	});
});
