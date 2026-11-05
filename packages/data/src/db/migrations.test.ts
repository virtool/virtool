import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generateDrizzleJson } from "drizzle-kit/api";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { PgDialect, type PgSession } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { expect, it, onTestFinished } from "vitest";

import type { PgClient } from "./pg";
import * as schema from "./schema";
import { createTestDatabase } from "./test/fixtures";

const MIGRATIONS_FOLDER = fileURLToPath(
	new URL("../../drizzle", import.meta.url),
);

const JOURNAL_PATH = fileURLToPath(
	new URL("../../drizzle/meta/_journal.json", import.meta.url),
);

type JournalEntry = { idx: number; when: number; tag: string };

it("keep migration SQL and snapshots aligned with the journal", () => {
	const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as {
		entries: JournalEntry[];
	};
	const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);
	const sqlFiles = readdirSync(MIGRATIONS_FOLDER)
		.filter((file) => file.endsWith(".sql"))
		.sort();
	const snapshotFiles = readdirSync(`${MIGRATIONS_FOLDER}/meta`)
		.filter((file) => file.endsWith("_snapshot.json"))
		.sort();

	expect(sqlFiles).toEqual(entries.map(({ tag }) => `${tag}.sql`));
	expect(snapshotFiles).toEqual(
		entries.map(
			({ idx }) => `${idx.toString().padStart(4, "0")}_snapshot.json`,
		),
	);

	const snapshots = snapshotFiles.map(
		(file) =>
			JSON.parse(readFileSync(`${MIGRATIONS_FOLDER}/meta/${file}`, "utf8")) as {
				id: string;
				prevId: string;
			},
	);
	const latestSnapshot = JSON.parse(
		readFileSync(`${MIGRATIONS_FOLDER}/meta/${snapshotFiles.at(-1)}`, "utf8"),
	) as Record<string, unknown> & { id: string; prevId: string };
	const generatedSnapshot = generateDrizzleJson(
		schema as never,
		latestSnapshot.prevId,
		undefined,
		"snake_case",
	);

	expect({ ...generatedSnapshot, id: latestSnapshot.id }).toEqual(
		latestSnapshot,
	);

	expect(snapshots[0]?.prevId).toBe("00000000-0000-0000-0000-000000000000");
	for (let i = 1; i < snapshots.length; i++) {
		expect(snapshots[i]?.prevId).toBe(snapshots[i - 1]?.id);
	}
});

// The migrator applies every journal entry whose `when` is greater than the
// last `when` already recorded in `__drizzle_migrations`. A later entry with an
// earlier `when` therefore never runs on a database that reached the earlier
// one, so `when` must increase strictly with `idx` — not just be unique.
it("keep journal timestamps strictly increasing by idx", () => {
	const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as {
		entries: JournalEntry[];
	};

	const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);

	for (let i = 1; i < entries.length; i++) {
		const previous = entries[i - 1];
		const current = entries[i];

		expect(
			current.when,
			`${current.tag} (when ${current.when}) must sort after ${previous.tag} (when ${previous.when})`,
		).toBeGreaterThan(previous.when);
	}
});

type SnapshotTables = {
	tables: Record<
		string,
		{ name: string; columns: Record<string, { name: string }> }
	>;
};

// Migrations up to this one shipped before drops took two releases.
const LAST_UNGUARDED_IDX = 48;

/**
 * Get what a migration drops in the same step that removes it from the mirror.
 *
 * A running server still declares anything that its release's mirror has, so
 * it fails as soon as the migration applies.
 */
function getUnsafeDrops(
	previous: SnapshotTables,
	current: SnapshotTables,
	migrationSql: string,
): string[] {
	const drops: string[] = [];

	for (const [key, table] of Object.entries(previous.tables)) {
		const currentTable = current.tables[key];

		if (currentTable === undefined) {
			if (migrationSql.includes(`DROP TABLE "${table.name}"`)) {
				drops.push(table.name);
			}
			continue;
		}

		for (const { name } of Object.values(table.columns)) {
			if (
				currentTable.columns[name] === undefined &&
				migrationSql.includes(`DROP COLUMN "${name}"`)
			) {
				drops.push(`${table.name}.${name}`);
			}
		}
	}

	return drops;
}

it("find drops that remove schema from the mirror in the same migration", () => {
	const previous = {
		tables: {
			"public.kept": {
				name: "kept",
				columns: { a: { name: "a" }, b: { name: "b" } },
			},
			"public.gone": { name: "gone", columns: {} },
		},
	};
	const current = {
		tables: {
			"public.kept": { name: "kept", columns: { a: { name: "a" } } },
		},
	};

	expect(
		getUnsafeDrops(
			previous,
			current,
			'DROP TABLE "gone" CASCADE;ALTER TABLE "kept" DROP COLUMN "b";',
		),
	).toEqual(["kept.b", "gone"]);
	expect(getUnsafeDrops(previous, current, "SELECT 1;")).toEqual([]);
	expect(
		getUnsafeDrops(current, current, 'ALTER TABLE "kept" DROP COLUMN "b";'),
	).toEqual([]);
});

it("keep drops out of the migration that removes schema from the mirror", () => {
	const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as {
		entries: JournalEntry[];
	};

	function readSnapshot(idx: number): SnapshotTables {
		const file = `${idx.toString().padStart(4, "0")}_snapshot.json`;

		return JSON.parse(
			readFileSync(`${MIGRATIONS_FOLDER}/meta/${file}`, "utf8"),
		) as SnapshotTables;
	}

	for (const { idx, tag } of journal.entries) {
		if (idx <= LAST_UNGUARDED_IDX) {
			continue;
		}

		expect(
			getUnsafeDrops(
				readSnapshot(idx - 1),
				readSnapshot(idx),
				readFileSync(`${MIGRATIONS_FOLDER}/${tag}.sql`, "utf8"),
			),
			`${tag} must not drop schema that the previous release declares. See "Dropping a column" in the @virtool/data README`,
		).toEqual([]);
	}
});

async function describeSchema(client: PgClient) {
	const columns = await client`
		select table_name, column_name, data_type, is_nullable, column_default,
		       is_identity, identity_generation
		from information_schema.columns
		where table_schema = 'public'
		order by table_name, column_name
	`;

	const constraints = await client`
		select conrelid::regclass::text as table_name, conname,
		       pg_get_constraintdef(oid) as definition
		from pg_constraint
		where connamespace = 'public'::regnamespace
		order by table_name, conname
	`;

	const indexes = await client`
		select tablename, indexname, indexdef
		from pg_indexes
		where schemaname = 'public'
		order by tablename, indexname
	`;

	const sequences = await client`
		select sequence_name, data_type, start_value, increment, maximum_value
		from information_schema.sequences
		where sequence_schema = 'public'
		order by sequence_name
	`;

	return {
		columns: [...columns],
		constraints: [...constraints],
		indexes: [...indexes],
		sequences: [...sequences],
	};
}

it("apply from empty and land on the schema mirror", async () => {
	const url = new URL(process.env.VT_POSTGRES_URL as string);
	const name = `migrations_${randomBytes(8).toString("hex")}`;

	const admin = postgres(url.toString(), { max: 1 });
	await admin.unsafe(`create database "${name}"`);

	url.pathname = `/${name}`;
	const client = postgres(url.toString(), { max: 1 });

	onTestFinished(async () => {
		await client.end();
		await admin.unsafe(`drop database if exists "${name}" with (force)`);
		await admin.end();
	});

	const config = {
		migrationsFolder: MIGRATIONS_FOLDER,
		migrationsSchema: "drizzle",
		migrationsTable: "__drizzle_migrations",
	};
	const db = drizzle(client, { schema });
	const dialect = new PgDialect();
	const migrations = readMigrationFiles(config);
	const session = db._.session as unknown as PgSession;

	for (const [index, migration] of migrations.entries()) {
		const assertion = migration.sql[0]?.match(
			/key\s*=\s*'([^']+)'\s+AND\s+version\s*=\s*(\d+)\s+AND\s+status\s*=\s*'passed'/i,
		);
		if (assertion === null || assertion === undefined) {
			continue;
		}

		await dialect.migrate(migrations.slice(0, index), session, config);
		await client`
			insert into data_migrations (key, version, kind, status)
			values (${assertion[1]}, ${Number(assertion[2])}, 'audit', 'passed')
			on conflict (key, version) do nothing
		`;
	}

	await dialect.migrate(migrations, session, config);

	const mirror = await createTestDatabase();
	onTestFinished(mirror.drop);

	expect(await describeSchema(client)).toEqual(
		await describeSchema(mirror.client),
	);
}, 120_000);
