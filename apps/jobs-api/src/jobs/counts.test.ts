import { JobState, JobWorkflow } from "@virtool/contracts";
import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { jobs } from "@virtool/data/db/schema/jobs";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { createLogger } from "@virtool/logger";
import { MemoryStorage } from "@virtool/storage";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app";
import { seedJob } from "../auth/test/fixtures";
import { createMetrics } from "../metrics/registry";
import { handleReadJobCounts } from "./counts";

let database: TestDatabase;
let db: Db;
let userId: number;

const logger = createLogger({ name: "test", level: "silent" });

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(jobs);
	await db.delete(users);

	userId = await seedUser(db, { handle: "bob" });
});

/**
 * A fresh app per call, because the queue read is memoized for the app's
 * lifetime — one shared between tests would serve the first test's rows to the
 * second.
 */
function app() {
	return createApp({
		client: database.client,
		db,
		storage: new MemoryStorage(),
		logger,
		metrics: createMetrics(10, "1.2.3"),
		applicationName: "virtool-ts-jobs-api@test",
		metricsToken: undefined,
		isReady: () => true,
	});
}

function request() {
	return app().request("https://jobs.virtool.test/jobs/counts");
}

/** The full cross product at zero, which every response is a departure from. */
function zeros(): Record<string, Record<string, number>> {
	return Object.fromEntries(
		JobState.options.map((state) => [
			state,
			Object.fromEntries(JobWorkflow.options.map((workflow) => [workflow, 0])),
		]),
	);
}

describe("GET /jobs/counts", () => {
	it("answers without a credential rather than falling through to /jobs/:jobId", async () => {
		const response = await request();

		expect(response.status).toBe(200);
	});

	it("serves every state and workflow as zero against an empty table", async () => {
		const response = await request();

		expect(await response.json()).toEqual(zeros());
	});

	it("counts pending and running jobs under their own workflow", async () => {
		await seedJob(db, userId, { state: "pending", workflow: "nuvs" });
		await seedJob(db, userId, { state: "pending", workflow: "nuvs" });
		await seedJob(db, userId, { state: "running", workflow: "pathoscope" });

		const response = await request();

		expect(await response.json()).toEqual({
			...zeros(),
			pending: { ...zeros().pending, nuvs: 2 },
			running: { ...zeros().running, pathoscope: 1 },
		});
	});

	// The divergence from Python, pinned. Its query groups over the whole table;
	// this one covers the non-terminal states alone, because the unbounded scan
	// grows forever. Nothing scales on a finished job.
	it("reports the terminal states as zero even where such rows exist", async () => {
		await seedJob(db, userId, { state: "succeeded", workflow: "nuvs" });
		await seedJob(db, userId, { state: "failed", workflow: "nuvs" });
		await seedJob(db, userId, { state: "cancelled", workflow: "nuvs" });

		expect(await (await request()).json()).toEqual(zeros());
	});

	// `jobs.workflow` is plain `text`, so a value the union does not name is
	// reachable. The response shape has no key to put it under and Python's has
	// none either, so it is dropped rather than folded.
	it("drops a workflow the union does not name", async () => {
		await seedJob(db, userId, { state: "pending", workflow: "wat" });
		await seedJob(db, userId, { state: "pending", workflow: "nuvs" });

		expect(await (await request()).json()).toEqual({
			...zeros(),
			pending: { ...zeros().pending, nuvs: 1 },
		});
	});
});

describe("handleReadJobCounts", () => {
	// Zeros would read as a drained queue and scale the fleet to nothing, so the
	// failure is left to reach `app.onError` and answer 500.
	it("propagates a failed read rather than answering zeros", async () => {
		await expect(
			handleReadJobCounts(() => Promise.reject(new Error("pool timed out"))),
		).rejects.toThrow("pool timed out");
	});
});
