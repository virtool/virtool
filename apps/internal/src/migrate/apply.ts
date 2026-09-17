import { readFileSync } from "node:fs";
import { getDataMigration } from "@virtool/data/data-migrations/data";
import type { Db, PgClient } from "@virtool/data/db/pg";
import type { Logger } from "@virtool/logger";
import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { PgDialect, type PgSession } from "drizzle-orm/pg-core";
import type { DataMigrationRegistry } from "../data-migrations/define";
import { validateMigrationPairs } from "../data-migrations/pairs";
import { executeDataMigration } from "../data-migrations/run";

/** A migration's identity and order in the Drizzle journal. */
type JournalEntry = { idx: number; when: number; tag: string };

function readJournal(migrationsFolder: string): JournalEntry[] {
	const journal = JSON.parse(
		readFileSync(`${migrationsFolder}/meta/_journal.json`, "utf8"),
	) as { entries: JournalEntry[] };
	const tags = new Set<string>();
	for (const [index, entry] of journal.entries.entries()) {
		if (
			entry.idx !== index ||
			!Number.isSafeInteger(entry.when) ||
			entry.when < 0 ||
			(index > 0 && entry.when <= (journal.entries[index - 1]?.when ?? -1)) ||
			tags.has(entry.tag)
		) {
			throw new Error(
				"migration journal must have unique tags and increasing indices and timestamps",
			);
		}
		tags.add(entry.tag);
	}
	return journal.entries;
}

/** The connection, implementations, and SQL journal used by the migration runner. */
export type ApplyGatedMigrationsOptions = {
	db: Db;
	client: PgClient;
	logger: Logger;
	signal: AbortSignal;
	migrationsFolder: string;
	migrationsSchema: string;
	migrationsTable: string;
	registry: DataMigrationRegistry;
};

/** The final committed boundary and the attempt that prevented further migration. */
export type ApplyGatedMigrationsResult = {
	appliedThrough: string | undefined;
	blockedAt?: string;
	outcome?: {
		key: string;
		version: number;
		status: "failed" | "errored";
		error: string | null;
	};
};

/** Apply SQL prefixes and their paired bodies while the caller holds the session lock. */
export async function applyGatedMigrations(
	options: ApplyGatedMigrationsOptions,
): Promise<ApplyGatedMigrationsResult> {
	const { db, client, logger, signal, migrationsFolder, registry } = options;
	const config = {
		migrationsFolder,
		migrationsSchema: options.migrationsSchema,
		migrationsTable: options.migrationsTable,
	};
	const entries = readJournal(migrationsFolder);
	const migrations = readMigrationFiles(config);
	if (entries.length !== migrations.length) {
		throw new Error("migration journal and SQL file counts differ");
	}
	const pairs = validateMigrationPairs(
		entries.map((entry, index) => ({
			tag: entry.tag,
			sql: migrations[index]?.sql ?? [],
		})),
		registry,
	);
	const dialect = new PgDialect();
	// Drizzle's public migrator uses this session too, but its generic is schema-free.
	const session = db._.session as unknown as PgSession;
	async function applyThrough(count: number): Promise<void> {
		signal.throwIfAborted();
		await dialect.migrate(migrations.slice(0, count), session, config);
	}
	// Let Drizzle create its own metadata before reading the applied position.
	await applyThrough(0);
	const applied = await db.execute<{ created_at: string }>(
		sql`select created_at from ${sql.identifier(config.migrationsSchema)}.${sql.identifier(config.migrationsTable)} order by created_at desc limit 1`,
	);
	const lastApplied =
		applied[0] === undefined ? -1 : Number(applied[0].created_at);
	let appliedThrough = entries.findLast(
		(entry) => entry.when <= lastApplied,
	)?.tag;
	for (const [index, entry] of entries.entries()) {
		if (entry.when <= lastApplied) {
			continue;
		}
		const definition = pairs.get(entry.tag);
		if (definition === undefined) {
			continue;
		}
		await applyThrough(index);
		appliedThrough = entries[index - 1]?.tag;
		signal.throwIfAborted();
		const previous = await getDataMigration(
			db,
			definition.key,
			definition.version,
		);
		if (previous?.status === "passed") {
			continue;
		}
		const outcome = await executeDataMigration(
			{ db, client, logger, signal },
			definition,
		);
		if (outcome.status !== "passed") {
			if (outcome.status === "running") {
				throw new Error("data migration returned an unfinished attempt");
			}
			return {
				appliedThrough,
				blockedAt: entry.tag,
				outcome: {
					key: outcome.key,
					version: outcome.version,
					status: outcome.status,
					error: outcome.error,
				},
			};
		}
	}
	await applyThrough(entries.length);
	return { appliedThrough: entries.at(-1)?.tag ?? appliedThrough };
}
