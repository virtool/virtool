import { randomBytes } from "node:crypto";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { createEmitter } from "../../events/emit";
import { testLogger } from "../../test/logger";
import type { Db, PgClient } from "../pg";
import * as schema from "../schema";

/** An isolated Postgres database, seeded with the schema, for one test file. */
export type TestDatabase = {
	db: Db;
	client: PgClient;
	drop: () => Promise<void>;
};

/** Options for {@link createTestDatabase}. */
export type TestDatabaseOptions = {
	/**
	 * Called with every statement the connection sends, so a test can count the
	 * round trips an operation costs. Off unless a test asks for it — it fires on
	 * the driver's hot path.
	 */
	onQuery?: (query: string) => void;
};

/**
 * The DDL for the whole schema, derived by diffing an empty schema against
 * ours. Cached because generating it costs more than running it, and every
 * test file in a worker needs the same statements.
 */
let ddl: Promise<string[]> | undefined;

function getDdl(): Promise<string[]> {
	// drizzle-kit is a test-only dependency, imported lazily so it never reaches
	// a production bundle. This materializes the schema into a throwaway
	// database — it is not a migration path. Python owns the real schema.
	ddl ??= import("drizzle-kit/api").then(
		({ generateDrizzleJson, generateMigration }) =>
			generateMigration(
				generateDrizzleJson({}),
				generateDrizzleJson(schema as never),
			),
	);

	return ddl;
}

/**
 * Create a fresh, isolated database and apply the schema to it.
 *
 * Vitest runs test files in parallel workers against a single Postgres
 * container. Each file therefore gets its own database rather than sharing
 * `public`, so that seeding in one file cannot be seen — or truncated — by
 * another.
 *
 * This also installs the process-wide client-event emitter on the new
 * connection, so a mutation that calls `emit` reaches the same database the
 * test is asserting against. Vitest's module registry is per file, as this
 * fixture is, so no two files can race on the handle.
 */
export async function createTestDatabase(
	options: TestDatabaseOptions = {},
): Promise<TestDatabase> {
	const statements = await getDdl();

	const url = new URL(process.env.VT_POSTGRES_URL as string);
	const name = `test_${randomBytes(8).toString("hex")}`;

	const admin = postgres(url.toString(), { max: 1 });
	await admin.unsafe(`create database "${name}"`);

	url.pathname = `/${name}`;
	const client = postgres(url.toString(), {
		max: 1,
		...(options.onQuery && {
			debug: (_connection, query) => options.onQuery?.(query),
		}),
	});

	for (const statement of statements) {
		await client.unsafe(statement);
	}

	async function drop(): Promise<void> {
		await client.end();
		await admin.unsafe(`drop database if exists "${name}" with (force)`);
		await admin.end();
	}

	createEmitter({ client, logger: testLogger });

	return { db: drizzle(client, { schema }), client, drop };
}
