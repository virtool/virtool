import {
	seedSetupSession,
	seedSetupToken,
	seedUser,
} from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { setupSessions, setupTokens } from "@virtool/data/db/schema/setup";
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
import { cleanupSetupStateTask } from "./cleanup-setup-state";
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
	await db.delete(setupSessions);
	await db.delete(setupTokens);
	await db.delete(users);
	await db.delete(tasks);

	ctx = createTaskTestContext({ db });
});

function minutesFromNow(minutes: number): Date {
	return new Date(Date.now() + minutes * 60 * 1000);
}

async function run() {
	const task = await claimTask(db, cleanupSetupStateTask);

	const outcome = await runTask({
		db,
		def: cleanupSetupStateTask,
		task,
		ctx,
		logger,
		signal: new AbortController().signal,
	});

	return { outcome, row: await readTaskRow(db, task.id) };
}

describe("cleanupSetupStateTask", () => {
	it("deletes the expired tokens and sessions and completes", async () => {
		const userId = await seedUser(db);

		await seedSetupToken(db, userId, "email_remediation", {
			expiresAt: minutesFromNow(-30),
		});
		await seedSetupToken(db, userId, "account_completion", {
			expiresAt: minutesFromNow(30),
		});
		await seedSetupSession(db, userId, "totp_enrollment", {
			expiresAt: minutesFromNow(-1),
		});

		const { outcome, row } = await run();

		expect(outcome).toEqual({ status: "completed" });
		expect(row).toMatchObject({
			complete: true,
			error: null,
			progress: 100,
			step: "cleanup_expired_setup_state",
		});

		expect(await db.select().from(setupTokens)).toHaveLength(1);
		expect(await db.select().from(setupSessions)).toHaveLength(0);
	});

	// Idempotent as a reclaim requires: a re-run deletes whatever is expired
	// when it runs, which is nothing if the first attempt got there.
	it("completes without deleting when nothing has expired", async () => {
		const userId = await seedUser(db);
		await seedSetupToken(db, userId, "account_completion", {
			expiresAt: minutesFromNow(30),
		});

		const { outcome, row } = await run();

		expect(outcome).toEqual({ status: "completed" });
		expect(row).toMatchObject({ complete: true, error: null, progress: 100 });
		expect(await db.select().from(setupTokens)).toHaveLength(1);
	});
});
