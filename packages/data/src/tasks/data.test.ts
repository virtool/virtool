import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db/pg";
import { tasks } from "../db/schema/tasks";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { createTask, getTask, TaskNotFoundError } from "./data";

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

describe("createTask", () => {
	it("inserts a pending task the runner will claim", async () => {
		const taskId = await createTask(db, "install_hmms", { user_id: 1 });

		const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId));

		expect(row).toMatchObject({
			type: "install_hmms",
			step: "install_hmms",
			context: { user_id: 1 },
			complete: false,
			progress: 0,
			acquired_at: null,
			error: null,
		});
	});

	it("defaults the context to an empty object", async () => {
		const taskId = await createTask(db, "install_hmms");

		const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId));

		expect(row?.context).toEqual({});
	});
});

describe("getTask", () => {
	it("returns the created task", async () => {
		const taskId = await createTask(db, "install_hmms");

		await expect(getTask(db, taskId)).resolves.toMatchObject({
			id: taskId,
			type: "install_hmms",
			complete: false,
			progress: 0,
		});
	});

	it("throws TaskNotFoundError when the task is absent", async () => {
		await expect(getTask(db, 404_404)).rejects.toThrow(TaskNotFoundError);
	});
});
