import { randomBytes } from "node:crypto";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	acquireDataMigrationsLock,
	finishDataMigration,
	getDataMigration,
	releaseDataMigrationsLock,
	startDataMigrationAttempt,
} from "@virtool/data/data-migrations/data";
import { createDb } from "@virtool/data/db/pg";
import { createLogger } from "@virtool/logger";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { expect, it, onTestFinished } from "vitest";
import { z } from "zod";
import {
	type DataMigrationRegistry,
	defineAudit,
	defineBackfill,
	type RegisteredDataMigration,
} from "../data-migrations/define";
import {
	BOOTSTRAP_MIGRATION_TAG,
	getDataMigrationAssertion,
} from "../data-migrations/pairs";
import { applyGatedMigrations } from "./apply";
import { createMigrationDb } from "./connection";

const logger = createLogger({ name: "test", level: "silent" });
const B_TAG = "0025_drop_legacy";
const C_TAG = "0027_check_marker";
const bootstrapSql = readFileSync(
	fileURLToPath(
		new URL(
			"../../../../packages/data/drizzle/0026_add_data_migrations.sql",
			import.meta.url,
		),
	),
	"utf8",
);
const files = [
	{ tag: BOOTSTRAP_MIGRATION_TAG, sql: bootstrapSql },
	{
		tag: "0024_legacy",
		sql: "CREATE TABLE legacy (id integer PRIMARY KEY, value text); INSERT INTO legacy VALUES (1, 'old'), (2, 'old'), (3, 'old');",
	},
	{
		tag: B_TAG,
		sql: `${getDataMigrationAssertion("b", 1)}\n--> statement-breakpoint\nALTER TABLE legacy DROP COLUMN value;`,
	},
	{ tag: "0026_marker", sql: "CREATE TABLE marker (id integer PRIMARY KEY);" },
	{ tag: C_TAG, sql: getDataMigrationAssertion("c", 1) },
	{ tag: "0028_suffix", sql: "CREATE TABLE suffix (id integer PRIMARY KEY);" },
];

function folderFor(entries = files): string {
	const folder = mkdtempSync(join(tmpdir(), "virtool-migrations-"));
	onTestFinished(() => rmSync(folder, { recursive: true, force: true }));
	mkdirSync(join(folder, "meta"));
	for (const file of entries) {
		writeFileSync(join(folder, `${file.tag}.sql`), file.sql);
	}
	writeFileSync(
		join(folder, "meta/_journal.json"),
		JSON.stringify({
			version: "7",
			dialect: "postgresql",
			entries: entries.map((file, idx) => ({
				idx,
				when: idx + 1,
				tag: file.tag,
				breakpoints: true,
				version: "7",
			})),
		}),
	);
	return folder;
}

async function fixture() {
	const url = new URL(process.env.VT_POSTGRES_URL as string);
	const admin = postgres(url.toString(), { max: 1 });
	const name = `apply_${randomBytes(8).toString("hex")}`;
	await admin.unsafe(`create database "${name}"`);
	url.pathname = `/${name}`;
	const controller = new AbortController();
	const { db, client } = createMigrationDb(url.toString(), controller);
	onTestFinished(async () => {
		await client.end();
		await admin.unsafe(`drop database if exists "${name}" with (force)`);
		await admin.end();
	});
	const calls: string[] = [];
	let dirty = false;
	const registry = {
		c: defineAudit({
			key: "c",
			migrationTag: C_TAG,
			version: 1,
			kind: "audit",
			description: "checks the later schema",
			async run({ client }) {
				calls.push("c");
				await client`select id from marker`;
			},
		}),
		b: defineAudit({
			key: "b",
			migrationTag: B_TAG,
			version: 1,
			kind: "audit",
			description: "checks historical data",
			async run({ client, report }) {
				calls.push("b");
				await client`select value from legacy`;
				if (dirty) {
					report({ code: "dirty" });
				}
			},
		}) as RegisteredDataMigration,
	};
	const migrationsFolder = folderFor();
	async function apply(
		overrides: {
			registry?: DataMigrationRegistry;
			migrationsFolder?: string;
		} = {},
	) {
		if (!(await acquireDataMigrationsLock(client))) {
			throw new Error("another migration holds the lock");
		}
		try {
			return await applyGatedMigrations({
				db,
				client,
				logger,
				signal: controller.signal,
				migrationsFolder,
				migrationsSchema: "drizzle",
				migrationsTable: "__drizzle_migrations",
				registry,
				...overrides,
			});
		} finally {
			await releaseDataMigrationsLock(client);
		}
	}
	async function prefix() {
		await migrate(db, { migrationsFolder: folderFor(files.slice(0, 2)) });
	}
	async function hasTable(table: string) {
		const rows = await client<
			{ present: boolean }[]
		>`select to_regclass(${`public.${table}`}) is not null as present`;
		return rows[0]?.present ?? false;
	}
	return {
		db,
		client,
		controller,
		registry,
		calls,
		apply,
		prefix,
		hasTable,
		migrationsFolder,
		setDirty(value: boolean) {
			dirty = value;
		},
		url: url.toString(),
	};
}

it("completes a fresh database in journal order and never reruns historical bodies", async () => {
	const f = await fixture();
	expect(await f.apply()).toEqual({ appliedThrough: "0028_suffix" });
	expect(f.calls).toEqual(["b", "c"]);
	expect(await f.hasTable("suffix")).toBe(true);
	await expect(f.client`select value from legacy`).rejects.toThrow();
	// Even a revised implementation is irrelevant once its SQL boundary applied.
	f.registry.b.version = 2;
	writeFileSync(
		join(f.migrationsFolder, `${B_TAG}.sql`),
		`${getDataMigrationAssertion("b", 2)}\n--> statement-breakpoint\nALTER TABLE legacy DROP COLUMN value;`,
	);
	await f.apply();
	expect(f.calls).toEqual(["b", "c"]);
});

it("retains the preceding prefix and retries a failed audit after remediation", async () => {
	const f = await fixture();
	f.setDirty(true);
	expect(await f.apply()).toMatchObject({
		appliedThrough: "0024_legacy",
		blockedAt: B_TAG,
		outcome: { key: "b", status: "failed" },
	});
	expect(await f.hasTable("legacy")).toBe(true);
	expect(await f.hasTable("marker")).toBe(false);
	expect((await f.apply()).blockedAt).toBe(B_TAG);
	expect(f.calls).toEqual(["b", "b"]);
	f.setDirty(false);
	expect((await f.apply()).blockedAt).toBeUndefined();
	expect(f.calls).toEqual(["b", "b", "b", "c"]);
	expect(await getDataMigration(f.db, "b", 1)).toMatchObject({
		attempts: 3,
		status: "passed",
	});
});

it.each(["errored", "running", "passed", "wrong_version"] as const)(
	"handles a pending pair with a %s record",
	async (status) => {
		const f = await fixture();
		await f.prefix();
		const row = await startDataMigrationAttempt(
			f.db,
			"b",
			status === "wrong_version" ? 2 : 1,
			"audit",
		);
		if (status !== "running") {
			await finishDataMigration(f.db, row.id, {
				status: status === "errored" ? "errored" : "passed",
			});
		}
		await f.apply();
		expect(f.calls).toEqual(status === "passed" ? ["c"] : ["b", "c"]);
	},
);

it("replays a failing backfill batch without losing earlier checkpoints", async () => {
	const f = await fixture();
	const visited: number[] = [];
	let dirty = true;
	f.registry.b = defineBackfill({
		key: "b",
		migrationTag: B_TAG,
		version: 1,
		kind: "backfill",
		description: "rewrites historical values",
		batchSize: 1,
		cursor: z.number(),
		initialCursor: 0,
		async runBatch({ client, cursor, report }) {
			const rows = await client<
				{ id: number }[]
			>`select id from legacy where id > ${cursor} order by id limit 1`;
			if (!rows.length) {
				return null;
			}
			const id = rows[0]?.id;
			if (id === undefined) {
				throw new Error("missing fixture row");
			}
			visited.push(id);
			await client`update legacy set value = 'new' where id = ${id}`;
			if (id === 2 && dirty) {
				report({ code: "invalid", subject: String(id) });
			}
			return { cursor: id, processed: 1 };
		},
	});
	expect((await f.apply()).blockedAt).toBe(B_TAG);
	expect(await getDataMigration(f.db, "b", 1)).toMatchObject({
		progress: { cursor: 1, processed: 1, batches: 1 },
	});
	expect((await f.apply()).blockedAt).toBe(B_TAG);
	dirty = false;
	expect((await f.apply()).blockedAt).toBeUndefined();
	expect(visited).toEqual([1, 2, 2, 2, 3]);
	expect(await getDataMigration(f.db, "b", 1)).toMatchObject({
		progress: null,
		summary: { processed: 3, batches: 3 },
		attempts: 3,
	});
});

it("records body errors and retries on the next invocation", async () => {
	const f = await fixture();
	const original = f.registry.b;
	f.registry.b = defineAudit({
		...original,
		kind: "audit",
		async run() {
			throw new Error("broken body");
		},
	});
	expect((await f.apply()).outcome).toMatchObject({
		status: "errored",
		error: "broken body",
	});
	f.registry.b = original;
	expect((await f.apply()).blockedAt).toBeUndefined();
});

it.each([
	"missing",
	"failed",
	"errored",
	"running",
	"wrong_version",
	"passed",
] as const)("the direct SQL migrator enforces a %s record", async (status) => {
	const f = await fixture();
	await f.prefix();
	if (status !== "missing") {
		const row = await startDataMigrationAttempt(
			f.db,
			"b",
			status === "wrong_version" ? 2 : 1,
			"audit",
		);
		if (status !== "running") {
			await finishDataMigration(f.db, row.id, {
				status: status === "wrong_version" ? "passed" : status,
			});
		}
	}
	const folder = folderFor(files.slice(0, 3));
	if (status === "passed") {
		await migrate(f.db, { migrationsFolder: folder });
		await expect(f.client`select value from legacy`).rejects.toThrow();
	} else {
		await expect(migrate(f.db, { migrationsFolder: folder })).rejects.toThrow();
		expect(await f.client`select value from legacy`).toHaveLength(3);
		const rows = await f.client`select * from drizzle.__drizzle_migrations`;
		expect(rows).toHaveLength(2);
	}
});

it("stops after cancellation and leaves the SQL boundary pending", async () => {
	const f = await fixture();
	f.registry.b = defineAudit({
		...f.registry.b,
		kind: "audit",
		async run() {
			f.controller.abort();
		},
	});
	expect((await f.apply()).outcome?.status).toBe("errored");
	expect(await f.hasTable("marker")).toBe(false);
	expect(await f.client`select value from legacy`).toHaveLength(3);
});

it("does not run when a competing connection owns the lock", async () => {
	const f = await fixture();
	const other = createDb({ postgresUrl: f.url, postgresPoolMax: 1 }, "test");
	onTestFinished(() => other.client.end());
	expect(await acquireDataMigrationsLock(other.client)).toBe(true);
	await expect(f.apply()).rejects.toThrow("another migration holds the lock");
	expect(f.calls).toEqual([]);
	await releaseDataMigrationsLock(other.client);
	await f.apply();
	expect(f.calls).toEqual(["b", "c"]);
});

it("closes permanently when the lock connection is lost", async () => {
	const f = await fixture();
	const other = postgres(f.url, { max: 1 });
	onTestFinished(() => other.end());
	await acquireDataMigrationsLock(f.client);
	const rows = await f.client<
		{ pid: number }[]
	>`select pg_backend_pid() as pid`;
	const pid = rows[0]?.pid;
	if (pid === undefined) {
		throw new Error("missing backend pid");
	}
	const closed = new Promise<void>((resolve) =>
		f.controller.signal.addEventListener("abort", () => resolve(), {
			once: true,
		}),
	);
	await other`select pg_terminate_backend(${pid})`;
	await closed;
	await expect(f.client`select 1`).rejects.toThrow();
	expect(f.controller.signal.aborted).toBe(true);
});

it("applies an unpaired SQL chain with an empty registry", async () => {
	const f = await fixture();
	const result = await f.apply({
		registry: {},
		migrationsFolder: folderFor(files.slice(0, 2)),
	});
	expect(result).toEqual({ appliedThrough: "0024_legacy" });
	expect(await f.hasTable("legacy")).toBe(true);
	expect(f.calls).toEqual([]);
});

it("rejects missing implementations before applying any prefix", async () => {
	const f = await fixture();
	await expect(f.apply({ registry: {} })).rejects.toThrow(
		"missing or ambiguous implementation",
	);
	expect(await f.hasTable("data_migrations")).toBe(false);
});

it("rejects an out-of-order journal before executing bodies", async () => {
	const f = await fixture();
	const path = join(f.migrationsFolder, "meta/_journal.json");
	const journal = JSON.parse(readFileSync(path, "utf8"));
	journal.entries[1].when = journal.entries[0].when;
	writeFileSync(path, JSON.stringify(journal));
	await expect(f.apply()).rejects.toThrow("increasing indices and timestamps");
	expect(f.calls).toEqual([]);
	expect(await f.hasTable("data_migrations")).toBe(false);
});
