import { gunzipSync } from "node:zlib";
import type { HmmAnnotationRecord } from "@virtool/contracts";
import type { Db } from "@virtool/data/db/pg";
import { hmms } from "@virtool/data/db/schema/hmms";
import { tasks } from "@virtool/data/db/schema/tasks";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { createLogger, type Logger } from "@virtool/logger";
import { HMM_ANNOTATIONS_KEY, MemoryStorage } from "@virtool/storage";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runTask } from "../framework/run";
import {
	claimTask,
	createTaskTestContext,
	readTaskRow,
} from "../testing/tasks";
import { recreateHmmAnnotationsTask } from "./recreate-hmm-annotations";

const logger: Logger = createLogger({ name: "test", level: "silent" });

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
	await db.delete(hmms);
	await db.delete(tasks);
});

describe("recreateHmmAnnotationsTask", () => {
	it("writes the missing blob and completes", async () => {
		const storage = new MemoryStorage();

		await db.insert(hmms).values({
			cluster: 12,
			count: 3,
			entries: [],
			families: {},
			genera: {},
			hidden: false,
			length: 100,
			mean_entropy: 0.5,
			names: ["protein"],
			total_entropy: 50.5,
		});

		const task = await claimTask(db, recreateHmmAnnotationsTask);

		expect(
			await runTask({
				db,
				def: recreateHmmAnnotationsTask,
				task,
				ctx: createTaskTestContext({ db, storage }),
				logger,
				signal: new AbortController().signal,
			}),
		).toEqual({ status: "completed" });

		expect(await readTaskRow(db, task.id)).toMatchObject({
			complete: true,
			error: null,
			step: "recreate",
		});

		const parts: Uint8Array[] = [];

		for await (const part of storage.read(HMM_ANNOTATIONS_KEY)) {
			parts.push(part);
		}

		const records = JSON.parse(
			gunzipSync(Buffer.concat(parts)).toString(),
		) as HmmAnnotationRecord[];

		expect(records.map((record) => record.cluster)).toEqual([12]);
	});
});
