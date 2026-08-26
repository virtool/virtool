import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
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

	await migrate(drizzle(client, { schema }), {
		migrationsFolder: MIGRATIONS_FOLDER,
		migrationsSchema: "drizzle",
		migrationsTable: "__drizzle_migrations",
	});

	const mirror = await createTestDatabase();
	onTestFinished(mirror.drop);

	expect(await describeSchema(client)).toEqual(
		await describeSchema(mirror.client),
	);
}, 120_000);
