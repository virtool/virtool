import { readFileSync } from "node:fs";

import type { Db } from "@virtool/data/db/pg";
import type { Logger } from "@virtool/logger";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { PgDialect, type PgSession } from "drizzle-orm/pg-core";
import type { OperationRegistry } from "../operations/define";
import { evaluateMigrationGate, type GateBlocker } from "../operations/gate";
import {
	BOOTSTRAP_MIGRATION_TAG,
	type MigrationGates,
} from "../operations/gates";

/** One entry of drizzle's `meta/_journal.json`. */
type JournalEntry = { idx: number; when: number; tag: string };

/**
 * Read the journal that names the migrations, in the order they apply.
 *
 * `readMigrationFiles` returns the SQL of each migration but not its tag, so
 * the two are read separately and joined by position — which is sound because
 * both walk `journal.entries` in the same order, and a test in `@virtool/data`
 * holds `when` strictly increasing with `idx` so that order is also the order
 * Postgres will see them applied in.
 */
function readJournal(migrationsFolder: string): JournalEntry[] {
	const journal = JSON.parse(
		readFileSync(`${migrationsFolder}/meta/_journal.json`, "utf8"),
	) as { entries: JournalEntry[] };

	return [...journal.entries].sort((a, b) => a.idx - b.idx);
}

/**
 * Reject gate declarations that could never be satisfied.
 *
 * Both mistakes here are deployment mistakes that would otherwise surface as a
 * migration that mysteriously never applies: a gate on a migration that does
 * not exist does nothing at all, and a gate at or before the bootstrap
 * migration asks the runner to read tables that migration has not yet created.
 */
function checkGateDeclarations(
	entries: JournalEntry[],
	gates: MigrationGates,
): void {
	const positions = new Map(entries.map((entry, index) => [entry.tag, index]));

	const bootstrap = positions.get(BOOTSTRAP_MIGRATION_TAG);

	if (bootstrap === undefined) {
		throw new Error(
			`the bootstrap migration ${BOOTSTRAP_MIGRATION_TAG} is missing from the journal`,
		);
	}

	for (const tag of Object.keys(gates)) {
		const position = positions.get(tag);

		if (position === undefined) {
			throw new Error(`gated migration ${tag} is missing from the journal`);
		}

		if (position <= bootstrap) {
			throw new Error(
				`gated migration ${tag} is not after ${BOOTSTRAP_MIGRATION_TAG}, so its gate could never be satisfied`,
			);
		}
	}
}

/** What {@link applyGatedMigrations} needs to apply the chain. */
export type ApplyGatedMigrationsOptions = {
	db: Db;
	logger: Logger;
	migrationsFolder: string;
	migrationsSchema: string;
	migrationsTable: string;
	gates: MigrationGates;
	registry: OperationRegistry;
};

/** How far the chain got, and what stopped it. */
export type ApplyGatedMigrationsResult = {
	/** The last migration eligible to apply, or `undefined` when none was. */
	appliedThrough: string | undefined;
	/** The migration a gate stopped at, if one did. */
	blockedAt: string | undefined;
	/** Every unsatisfied requirement of `blockedAt`. */
	blockers: GateBlocker[];
};

/**
 * Apply pending migrations, stopping at the first one whose required
 * operations have not passed.
 *
 * Migrations are applied in journal order in one or more segments rather than
 * one call, because a gate has to be evaluated against a database the
 * migrations before it have already reached: the bootstrap migration creates
 * the very tables the gate reads. Each segment is drizzle's own migrator over a
 * prefix of the same migration list, so which of them are still pending — and
 * the bookkeeping row each one writes — is decided by drizzle exactly as it is
 * on an ungated run.
 *
 * A blocked chain is not an error here. The caller decides what a deploy does
 * about it; this reports what happened.
 */
export async function applyGatedMigrations(
	options: ApplyGatedMigrationsOptions,
): Promise<ApplyGatedMigrationsResult> {
	const { db, logger, migrationsFolder, gates, registry } = options;

	const config = {
		migrationsFolder,
		migrationsSchema: options.migrationsSchema,
		migrationsTable: options.migrationsTable,
	};

	const migrations = readMigrationFiles(config);
	const entries = readJournal(migrationsFolder);

	if (entries.length !== migrations.length) {
		throw new Error(
			`the journal names ${entries.length} migrations but ${migrations.length} were read`,
		);
	}

	checkGateDeclarations(entries, gates);

	const dialect = new PgDialect();

	/*
	 `migrate` types its session against the default, empty schema generics,
	 which a schema-typed handle is not assignable to. It only executes SQL
	 through it, and drizzle's own `migrate` passes this same object.
	*/
	const session = db._.session as unknown as PgSession;

	async function applyThrough(count: number): Promise<void> {
		await dialect.migrate(migrations.slice(0, count), session, config);
	}

	for (const [index, entry] of entries.entries()) {
		const required = gates[entry.tag];

		if (required === undefined || required.length === 0) {
			continue;
		}

		await applyThrough(index);

		const blockers = await evaluateMigrationGate(
			db,
			registry,
			entry.tag,
			required,
		);

		if (blockers.length > 0) {
			return {
				appliedThrough: entries[index - 1]?.tag,
				blockedAt: entry.tag,
				blockers,
			};
		}

		logger.info(
			{ tag: entry.tag, required },
			"satisfied the gate on a migration",
		);
	}

	await applyThrough(entries.length);

	return {
		appliedThrough: entries[entries.length - 1]?.tag,
		blockedAt: undefined,
		blockers: [],
	};
}
