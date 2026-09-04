import type { Db } from "@virtool/data/db/pg";
import { databaseOperations } from "@virtool/data/db/schema/operations";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import {
	finishOperation,
	startOperationAttempt,
} from "@virtool/data/operations/data";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

import { defineAudit, type OperationRegistry } from "./define";
import { evaluateMigrationGate } from "./gate";

let database: TestDatabase;
let db: Db;

const TAG = "0024_gated";

const registry: OperationRegistry = {
	demo: defineAudit({
		key: "demo",
		kind: "audit",
		version: 2,
		description: "a check that never runs here",
		run: async () => {},
	}),
};

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

/** Record `status` for the registered version of `demo`. */
async function record(
	status: "running" | "passed" | "failed" | "errored",
	version = 2,
): Promise<void> {
	const row = await startOperationAttempt(db, "demo", version, "audit");

	if (status !== "running") {
		await finishOperation(db, row.id, {
			status,
			...(status === "errored" && { error: "connection lost" }),
		});
	}
}

it("let a migration through when every requirement passed", async () => {
	await record("passed");

	expect(await evaluateMigrationGate(db, registry, TAG, ["demo"])).toEqual([]);
});

it("let a migration with no requirements through", async () => {
	expect(await evaluateMigrationGate(db, registry, TAG, [])).toEqual([]);
});

it("block a requirement no image carries", async () => {
	const blockers = await evaluateMigrationGate(db, registry, TAG, ["absent"]);

	expect(blockers).toMatchObject([
		{ tag: TAG, key: "absent", version: undefined, reason: "unregistered" },
	]);
});

it("block a requirement that has never run", async () => {
	expect(
		await evaluateMigrationGate(db, registry, TAG, ["demo"]),
	).toMatchObject([{ key: "demo", version: 2, reason: "never_run" }]);
});

it("block a pass recorded against an earlier implementation", async () => {
	await record("passed", 1);

	const blockers = await evaluateMigrationGate(db, registry, TAG, ["demo"]);

	expect(blockers).toMatchObject([
		{ key: "demo", version: 2, reason: "stale" },
	]);
	expect(blockers[0]?.detail).toContain("version 1");
});

it("block an attempt that is recorded as still running", async () => {
	await record("running");

	expect(
		await evaluateMigrationGate(db, registry, TAG, ["demo"]),
	).toMatchObject([{ key: "demo", reason: "running" }]);
});

it("block an operation that reported findings", async () => {
	await record("failed");

	expect(
		await evaluateMigrationGate(db, registry, TAG, ["demo"]),
	).toMatchObject([{ key: "demo", reason: "failed" }]);
});

it("block an operation that broke before concluding, and say how", async () => {
	await record("errored");

	const blockers = await evaluateMigrationGate(db, registry, TAG, ["demo"]);

	expect(blockers).toMatchObject([{ key: "demo", reason: "errored" }]);
	expect(blockers[0]?.detail).toContain("connection lost");
});

it("report every unsatisfied requirement rather than the first", async () => {
	const blockers = await evaluateMigrationGate(db, registry, TAG, [
		"demo",
		"absent",
	]);

	expect(blockers.map((blocker) => blocker.reason)).toEqual([
		"never_run",
		"unregistered",
	]);
});
