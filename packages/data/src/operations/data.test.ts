import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db/pg";
import {
	databaseOperationFindings,
	databaseOperations,
} from "../db/schema/operations";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	acquireOperationsLock,
	finishOperation,
	getOperation,
	listOperationFindings,
	listOperations,
	listOperationVersions,
	recordOperationFindings,
	releaseOperationsLock,
	startOperationAttempt,
	updateOperationProgress,
} from "./data";

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
	await db.delete(databaseOperations);
});

describe("startOperationAttempt", () => {
	it("open the first attempt as running", async () => {
		const row = await startOperationAttempt(db, "demo", 1, "audit");

		expect(row).toMatchObject({
			key: "demo",
			version: 1,
			kind: "audit",
			status: "running",
			attempts: 1,
			error: null,
			finishedAt: null,
		});

		expect(row.startedAt).toBeInstanceOf(Date);
	});

	it("reuse the row and count the attempt on a retry", async () => {
		const first = await startOperationAttempt(db, "demo", 1, "audit");

		await finishOperation(db, first.id, {
			status: "errored",
			error: "broke",
		});

		const second = await startOperationAttempt(db, "demo", 1, "audit");

		expect(second.id).toBe(first.id);
		expect(second).toMatchObject({
			status: "running",
			attempts: 2,
			error: null,
			finishedAt: null,
		});
	});

	it("keep a separate row per implementation version", async () => {
		await startOperationAttempt(db, "demo", 1, "audit");
		await startOperationAttempt(db, "demo", 2, "audit");

		const versions = await listOperationVersions(db, "demo");

		expect(versions.map((row) => row.version)).toEqual([1, 2]);
		expect(await getOperation(db, "demo", 3)).toBeUndefined();
	});

	it("clear the previous attempt's findings but keep its resume point", async () => {
		const first = await startOperationAttempt(db, "demo", 1, "data_migration");

		await recordOperationFindings(db, first.id, [{ code: "stale" }]);
		await updateOperationProgress(db, first.id, { cursor: 7, processed: 7 });

		const second = await startOperationAttempt(db, "demo", 1, "data_migration");

		expect(await listOperationFindings(db, second.id)).toHaveLength(0);
		expect(second.progress).toEqual({ cursor: 7, processed: 7 });
	});
});

describe("recordOperationFindings", () => {
	it("write nothing for an empty list", async () => {
		const row = await startOperationAttempt(db, "demo", 1, "audit");

		await recordOperationFindings(db, row.id, []);

		expect(await listOperationFindings(db, row.id)).toHaveLength(0);
	});

	it("keep code, subject and detail, and default the optional halves", async () => {
		const row = await startOperationAttempt(db, "demo", 1, "audit");

		await recordOperationFindings(db, row.id, [
			{ code: "orphan", subject: "user:7", detail: { table: "users" } },
			{ code: "orphan" },
		]);

		const findings = await listOperationFindings(db, row.id);

		expect(findings).toMatchObject([
			{ code: "orphan", subject: "user:7", detail: { table: "users" } },
			{ code: "orphan", subject: null, detail: null },
		]);
	});

	it("go with the operation when it is deleted", async () => {
		const row = await startOperationAttempt(db, "demo", 1, "audit");

		await recordOperationFindings(db, row.id, [{ code: "orphan" }]);
		await db
			.delete(databaseOperations)
			.where(eq(databaseOperations.id, row.id));

		expect(await db.select().from(databaseOperationFindings)).toHaveLength(0);
	});
});

describe("finishOperation", () => {
	it("record a pass and drop the resume point", async () => {
		const row = await startOperationAttempt(db, "demo", 1, "data_migration");

		await updateOperationProgress(db, row.id, { cursor: 12 });

		const finished = await finishOperation(db, row.id, {
			status: "passed",
			summary: { processed: 12 },
		});

		expect(finished).toMatchObject({
			status: "passed",
			summary: { processed: 12 },
			progress: null,
			error: null,
		});

		expect(finished.finishedAt).toBeInstanceOf(Date);
	});

	it("keep the resume point of an attempt that did not pass", async () => {
		const row = await startOperationAttempt(db, "demo", 1, "data_migration");

		await updateOperationProgress(db, row.id, { cursor: 12 });

		const finished = await finishOperation(db, row.id, {
			status: "errored",
			error: "connection lost",
		});

		expect(finished).toMatchObject({
			status: "errored",
			error: "connection lost",
			progress: { cursor: 12 },
		});
	});
});

describe("listOperations", () => {
	it("order by key then version", async () => {
		await startOperationAttempt(db, "second", 1, "audit");
		await startOperationAttempt(db, "first", 2, "audit");
		await startOperationAttempt(db, "first", 1, "audit");

		expect(
			(await listOperations(db)).map((row) => `${row.key}@${row.version}`),
		).toEqual(["first@1", "first@2", "second@1"]);
	});
});

describe("the run lock", () => {
	it("exclude a second session until the first releases", async () => {
		const first = database.connect();
		const second = database.connect();

		try {
			expect(await acquireOperationsLock(first.client)).toBe(true);
			expect(await acquireOperationsLock(second.client)).toBe(false);

			await releaseOperationsLock(first.client);

			expect(await acquireOperationsLock(second.client)).toBe(true);

			await releaseOperationsLock(second.client);
		} finally {
			await first.close();
			await second.close();
		}
	});

	it("release the lock when the holding session goes away", async () => {
		const holder = database.connect();
		const other = database.connect();

		try {
			expect(await acquireOperationsLock(holder.client)).toBe(true);

			// What happens to a Job that is killed rather than shut down: nothing
			// releases the lock, and the next run may only proceed because Postgres
			// reaped the backend.
			await holder.close();

			expect(await acquireOperationsLock(other.client)).toBe(true);

			await releaseOperationsLock(other.client);
		} finally {
			await other.close();
		}
	});
});
