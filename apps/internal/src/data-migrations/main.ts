import { resolveFileBacked } from "@virtool/contracts/env";
import {
	getDataMigration,
	listDataMigrationFindings,
	listDataMigrations,
} from "@virtool/data/data-migrations/data";
import { createDb, type Db } from "@virtool/data/db/pg";
import { createLogger, type Logger } from "@virtool/logger";
import { z } from "zod";

import type { DataMigrationRegistry } from "./define";
import { DATA_MIGRATIONS } from "./registry";

const SERVICE = "data-migrations";

const DataMigrationsEnv = z.object({
	VT_POSTGRES_URL: z.string().url(),
});

/** Every environment key this entrypoint reads. */
const DATA_MIGRATIONS_ENV_KEYS: string[] = Object.keys(DataMigrationsEnv.shape);

/** What every subcommand here receives. */
type Deps = {
	db: Db;
	logger: Logger;
	registry: DataMigrationRegistry;
};

/** Report what every registered and every recorded data migration is at. */
async function list(deps: Deps): Promise<void> {
	const rows = await listDataMigrations(deps.db);
	const recorded = new Map(
		rows.map((row) => [`${row.key}@${row.version}`, row]),
	);

	for (const definition of Object.values(deps.registry)) {
		const row = recorded.get(`${definition.key}@${definition.version}`);

		deps.logger.info(
			{
				migration: definition.key,
				version: definition.version,
				kind: definition.kind,
				status: row?.status ?? "never_run",
				attempts: row?.attempts ?? 0,
				description: definition.description,
			},
			"registered data migration",
		);
	}

	// A row whose key is no longer registered still matters: it is the history
	// an operator reads when a gate they cannot explain starts blocking.
	for (const row of rows) {
		if (deps.registry[row.key]?.version === row.version) {
			continue;
		}

		deps.logger.info(
			{
				migration: row.key,
				version: row.version,
				kind: row.kind,
				status: row.status,
				attempts: row.attempts,
			},
			"recorded data migration with no registered implementation at this version",
		);
	}
}

/**
 * Write one data migration's outcome and findings to stdout as JSON.
 *
 * stdout rather than the log, so `kubectl logs` output can be piped into
 * something that reads it. The log carries pino's own envelope, which a
 * consumer would then have to unwrap a document out of.
 */
async function exportDataMigration(deps: Deps, key: string): Promise<boolean> {
	const definition = deps.registry[key];

	if (definition === undefined) {
		throw new Error(`no data migration named "${key}" is registered`);
	}

	const row = await getDataMigration(deps.db, key, definition.version);

	if (row === undefined) {
		process.stdout.write(
			`${JSON.stringify({ key, version: definition.version, status: "never_run" }, null, 2)}\n`,
		);

		return false;
	}

	const findings = await listDataMigrationFindings(deps.db, row.id);

	process.stdout.write(
		`${JSON.stringify(
			{
				key: row.key,
				version: row.version,
				kind: row.kind,
				status: row.status,
				attempts: row.attempts,
				startedAt: row.startedAt,
				finishedAt: row.finishedAt,
				error: row.error,
				summary: row.summary,
				findings: findings.map((finding) => ({
					code: finding.code,
					subject: finding.subject,
					detail: finding.detail,
				})),
			},
			null,
			2,
		)}\n`,
	);

	return row.status === "passed";
}

/** Run the requested subcommand, and report whether it succeeded. */
async function dispatch(deps: Deps, argv: readonly string[]): Promise<boolean> {
	const [command, ...rest] = argv;

	switch (command) {
		case "list":
			await list(deps);
			return true;
		case "export": {
			const [key] = rest;

			if (key === undefined) {
				throw new Error("export needs the key of a data migration");
			}

			return exportDataMigration(deps, key);
		}
		default:
			throw new Error(
				`unknown data-migrations command ${command ? `"${command}"` : "(none)"}; expected one of list, export`,
			);
	}
}

async function doDataMigrations(argv: readonly string[]): Promise<void> {
	const env = DataMigrationsEnv.parse(
		resolveFileBacked(DATA_MIGRATIONS_ENV_KEYS, process.env),
	);

	const logger = createLogger({ name: SERVICE });

	const { client, db } = createDb(
		{ postgresUrl: env.VT_POSTGRES_URL, postgresPoolMax: 1 },
		SERVICE,
	);

	try {
		const present = await client<
			{ present: boolean }[]
		>`select to_regclass('public.data_migrations') is not null as present`;
		if (!present[0]?.present) {
			logger.info(
				"data migration tables are absent; run migrate to initialize the database",
			);
			process.exitCode = 1;
			return;
		}
		if (!(await dispatch({ db, logger, registry: DATA_MIGRATIONS }, argv))) {
			process.exitCode = 1;
		}
	} finally {
		await client.end();
	}
}

/** Inspect recorded data migration outcomes and findings. */
export async function startDataMigrations(
	argv: readonly string[],
): Promise<void> {
	try {
		await doDataMigrations(argv);
	} catch (err) {
		createLogger({ name: SERVICE }).fatal(
			{ err },
			"failed to inspect data migrations",
		);
		process.exitCode = 1;
	}
}
