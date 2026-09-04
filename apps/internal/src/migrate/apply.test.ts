import { randomBytes } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createDb, type Db, type PgClient } from "@virtool/data/db/pg";
import {
	finishOperation,
	startOperationAttempt,
} from "@virtool/data/operations/data";
import { createLogger, type Logger } from "@virtool/logger";
import postgres from "postgres";
import { beforeAll, expect, it, onTestFinished } from "vitest";

import { defineAudit, type OperationRegistry } from "../operations/define";
import { BOOTSTRAP_MIGRATION_TAG } from "../operations/gates";
import { applyGatedMigrations } from "./apply";

const logger: Logger = createLogger({ name: "test", level: "silent" });

const GATED_TAG = "0024_gated";

/** The real bootstrap migration, which the fixture chain is built on. */
const BOOTSTRAP_SQL = fileURLToPath(
	new URL(
		`../../../../packages/data/drizzle/${BOOTSTRAP_MIGRATION_TAG}.sql`,
		import.meta.url,
	),
);

const registry: OperationRegistry = {
	demo: defineAudit({
		key: "demo",
		kind: "audit",
		version: 1,
		description: "a check the fixture chain is gated on",
		run: async () => {},
	}),
};

let migrationsFolder: string;

/**
 * Build a two-migration chain: the real bootstrap, then one that is gated.
 *
 * The bootstrap file is copied rather than reproduced so this exercises the
 * tables the gate actually reads, and so a change to them cannot leave the
 * fixture testing a schema nothing has.
 */
beforeAll(() => {
	migrationsFolder = mkdtempSync(join(tmpdir(), "virtool-migrations-"));

	mkdirSync(join(migrationsFolder, "meta"));

	copyFileSync(
		BOOTSTRAP_SQL,
		join(migrationsFolder, `${BOOTSTRAP_MIGRATION_TAG}.sql`),
	);

	writeFileSync(
		join(migrationsFolder, `${GATED_TAG}.sql`),
		'CREATE TABLE "gated_marker" ("id" integer PRIMARY KEY);',
	);

	writeFileSync(
		join(migrationsFolder, "meta", "_journal.json"),
		JSON.stringify({
			version: "7",
			dialect: "postgresql",
			entries: [
				{
					idx: 0,
					version: "7",
					when: 1,
					tag: BOOTSTRAP_MIGRATION_TAG,
					breakpoints: true,
				},
				{ idx: 1, version: "7", when: 2, tag: GATED_TAG, breakpoints: true },
			],
		}),
	);
});

/** An empty database of its own, since a migration chain needs one. */
async function createScratchDatabase(): Promise<{ db: Db; client: PgClient }> {
	const url = new URL(process.env.VT_POSTGRES_URL as string);
	const name = `apply_${randomBytes(8).toString("hex")}`;

	const admin = postgres(url.toString(), { max: 1 });

	await admin.unsafe(`create database "${name}"`);

	url.pathname = `/${name}`;

	const { client, db } = createDb(
		{ postgresUrl: url.toString(), postgresPoolMax: 1 },
		"test",
	);

	onTestFinished(async () => {
		await client.end();
		await admin.unsafe(`drop database if exists "${name}" with (force)`);
		await admin.end();
	});

	return { db, client };
}

/** Whether the table the gated migration creates is there. */
async function hasMarker(client: PgClient): Promise<boolean> {
	const rows = await client<{ present: boolean }[]>`
		select to_regclass('public.gated_marker') is not null as present
	`;

	return rows[0]?.present === true;
}

/** Apply the fixture chain with `gates`. */
function apply(db: Db, gates: Record<string, readonly string[]>) {
	return applyGatedMigrations({
		db,
		logger,
		migrationsFolder,
		migrationsSchema: "drizzle",
		migrationsTable: "__drizzle_migrations",
		gates,
		registry,
	});
}

it("apply the whole chain when nothing is gated", async () => {
	const { db, client } = await createScratchDatabase();

	const result = await apply(db, {});

	expect(result).toMatchObject({ appliedThrough: GATED_TAG, blockers: [] });
	expect(result.blockedAt).toBeUndefined();
	expect(await hasMarker(client)).toBe(true);
}, 60_000);

it("apply the bootstrap but stop at a gate nothing satisfies", async () => {
	const { db, client } = await createScratchDatabase();

	const result = await apply(db, { [GATED_TAG]: ["demo"] });

	expect(result).toMatchObject({
		appliedThrough: BOOTSTRAP_MIGRATION_TAG,
		blockedAt: GATED_TAG,
		blockers: [{ key: "demo", reason: "never_run" }],
	});

	// The bootstrap ran, which is the only reason the gate could be evaluated
	// at all, and the gated migration did not.
	expect(await hasMarker(client)).toBe(false);
}, 60_000);

it("apply the rest once the required operation has passed", async () => {
	const { db, client } = await createScratchDatabase();

	await apply(db, { [GATED_TAG]: ["demo"] });

	const row = await startOperationAttempt(db, "demo", 1, "audit");
	await finishOperation(db, row.id, { status: "passed" });

	const result = await apply(db, { [GATED_TAG]: ["demo"] });

	expect(result.blockedAt).toBeUndefined();
	expect(await hasMarker(client)).toBe(true);
}, 60_000);

it("refuse a gate on a migration the journal does not name", async () => {
	const { db } = await createScratchDatabase();

	await expect(apply(db, { "0099_absent": ["demo"] })).rejects.toThrow(
		"0099_absent is missing from the journal",
	);
}, 60_000);

it("refuse a gate that runs before the tables it is evaluated against", async () => {
	const { db } = await createScratchDatabase();

	await expect(
		apply(db, { [BOOTSTRAP_MIGRATION_TAG]: ["demo"] }),
	).rejects.toThrow("could never be satisfied");
}, 60_000);
