import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db/pg";
import {
	dataMigrationFindings,
	dataMigrations,
} from "../db/schema/dataMigrations";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	acquireDataMigrationsLock,
	finishDataMigration,
	getDataMigration,
	listDataMigrationFindings,
	listDataMigrations,
	recordDataMigrationFindings,
	releaseDataMigrationsLock,
	startDataMigrationAttempt,
	updateDataMigrationProgress,
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
	await db.delete(dataMigrations);
});

describe("startDataMigrationAttempt", () => {
	it("open the first attempt as running", async () => {
		const row = await startDataMigrationAttempt(db, "demo", 1, "audit");

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
		const first = await startDataMigrationAttempt(db, "demo", 1, "audit");

		await finishDataMigration(db, first.id, {
			status: "errored",
			error: "broke",
		});

		const second = await startDataMigrationAttempt(db, "demo", 1, "audit");

		expect(second.id).toBe(first.id);
		expect(second).toMatchObject({
			status: "running",
			attempts: 2,
			error: null,
			finishedAt: null,
		});
	});

	it("keep a separate row per implementation version", async () => {
		await startDataMigrationAttempt(db, "demo", 1, "audit");
		await startDataMigrationAttempt(db, "demo", 2, "audit");

		const versions = await listDataMigrations(db);

		expect(versions.map((row) => row.version)).toEqual([1, 2]);
		expect(await getDataMigration(db, "demo", 3)).toBeUndefined();
	});

	it("clear the previous attempt's findings but keep its resume point", async () => {
		const first = await startDataMigrationAttempt(db, "demo", 1, "backfill");

		await recordDataMigrationFindings(db, first.id, [{ code: "stale" }]);
		await updateDataMigrationProgress(db, first.id, {
			cursor: 7,
			processed: 7,
		});

		const second = await startDataMigrationAttempt(db, "demo", 1, "backfill");

		expect(await listDataMigrationFindings(db, second.id)).toHaveLength(0);
		expect(second.progress).toEqual({ cursor: 7, processed: 7 });
	});
});

describe("recordDataMigrationFindings", () => {
	it("write nothing for an empty list", async () => {
		const row = await startDataMigrationAttempt(db, "demo", 1, "audit");

		await recordDataMigrationFindings(db, row.id, []);

		expect(await listDataMigrationFindings(db, row.id)).toHaveLength(0);
	});

	it("keep code, subject and detail, and default the optional halves", async () => {
		const row = await startDataMigrationAttempt(db, "demo", 1, "audit");

		await recordDataMigrationFindings(db, row.id, [
			{ code: "orphan", subject: "user:7", detail: { table: "users" } },
			{ code: "orphan" },
		]);

		const findings = await listDataMigrationFindings(db, row.id);

		expect(findings).toMatchObject([
			{ code: "orphan", subject: "user:7", detail: { table: "users" } },
			{ code: "orphan", subject: null, detail: null },
		]);
	});

	it("go with the operation when it is deleted", async () => {
		const row = await startDataMigrationAttempt(db, "demo", 1, "audit");

		await recordDataMigrationFindings(db, row.id, [{ code: "orphan" }]);
		await db.delete(dataMigrations).where(eq(dataMigrations.id, row.id));

		expect(await db.select().from(dataMigrationFindings)).toHaveLength(0);
	});
});

describe("finishDataMigration", () => {
	it("record a pass and drop the resume point", async () => {
		const row = await startDataMigrationAttempt(db, "demo", 1, "backfill");

		await updateDataMigrationProgress(db, row.id, { cursor: 12 });

		const finished = await finishDataMigration(db, row.id, {
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
		const row = await startDataMigrationAttempt(db, "demo", 1, "backfill");

		await updateDataMigrationProgress(db, row.id, { cursor: 12 });

		const finished = await finishDataMigration(db, row.id, {
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

describe("listDataMigrations", () => {
	it("order by key then version", async () => {
		await startDataMigrationAttempt(db, "second", 1, "audit");
		await startDataMigrationAttempt(db, "first", 2, "audit");
		await startDataMigrationAttempt(db, "first", 1, "audit");

		expect(
			(await listDataMigrations(db)).map((row) => `${row.key}@${row.version}`),
		).toEqual(["first@1", "first@2", "second@1"]);
	});
});

describe("the run lock", () => {
	it("exclude a second session until the first releases", async () => {
		const first = database.connect();
		const second = database.connect();

		try {
			expect(await acquireDataMigrationsLock(first.client)).toBe(true);
			expect(await acquireDataMigrationsLock(second.client)).toBe(false);

			await releaseDataMigrationsLock(first.client);

			expect(await acquireDataMigrationsLock(second.client)).toBe(true);

			await releaseDataMigrationsLock(second.client);
		} finally {
			await first.close();
			await second.close();
		}
	});

	it("release the lock when the holding session goes away", async () => {
		const holder = database.connect();
		const other = database.connect();

		try {
			expect(await acquireDataMigrationsLock(holder.client)).toBe(true);

			// What happens to a Job that is killed rather than shut down: nothing
			// releases the lock, and the next run may only proceed because Postgres
			// reaped the backend.
			await holder.close();

			expect(await acquireDataMigrationsLock(other.client)).toBe(true);

			await releaseDataMigrationsLock(other.client);
		} finally {
			await other.close();
		}
	});
});
