import { resolveFileBacked } from "@virtool/contracts/env";
import { createDb, type Db } from "@virtool/data/db/pg";
import {
	acquireOperationsLock,
	getOperation,
	listOperationFindings,
	listOperations,
	releaseOperationsLock,
} from "@virtool/data/operations/data";
import { createLogger, type Logger } from "@virtool/logger";
import { z } from "zod";

import type { OperationRegistry } from "./define";
import { OPERATIONS } from "./registry";
import { runOperation } from "./run";

/**
 * The name this entrypoint reports under, in logs and in `application_name`.
 *
 * Distinct from `migrate`, which shares the image and the lock but not the
 * job: a run that is rewriting rows for an hour and a run that is applying DDL
 * have to be told apart in `pg_stat_activity`.
 */
const SERVICE = "operations";

/*
 The same lean schema `migrate` reads. An operation needs a database and
 nothing else — no storage credentials, no probe port, no shutdown budget — so
 the Job's pod spec carries only that.
*/
const OperationsEnv = z.object({
	VT_POSTGRES_URL: z.string().url(),
});

/** Every environment key this entrypoint reads. */
const OPERATIONS_ENV_KEYS: string[] = Object.keys(OperationsEnv.shape);

/** What every subcommand here receives. */
type Deps = {
	db: Db;
	logger: Logger;
	registry: OperationRegistry;
};

/** Report what every registered and every recorded operation is at. */
async function list(deps: Deps): Promise<void> {
	const rows = await listOperations(deps.db);
	const recorded = new Map(
		rows.map((row) => [`${row.key}@${row.version}`, row]),
	);

	for (const definition of Object.values(deps.registry)) {
		const row = recorded.get(`${definition.key}@${definition.version}`);

		deps.logger.info(
			{
				operation: definition.key,
				version: definition.version,
				kind: definition.kind,
				status: row?.status ?? "never_run",
				attempts: row?.attempts ?? 0,
				description: definition.description,
			},
			"registered operation",
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
				operation: row.key,
				version: row.version,
				kind: row.kind,
				status: row.status,
				attempts: row.attempts,
			},
			"recorded operation with no registered implementation at this version",
		);
	}
}

/**
 * Run the named operations, or every registered one, in registry order.
 *
 * Returns whether all of them passed. A run that reaches a failing operation
 * keeps going: the operations after it are independent, and an operator would
 * rather learn about all of the remediation at once.
 */
async function run(
	deps: Deps,
	signal: AbortSignal,
	keys: readonly string[],
): Promise<boolean> {
	const selected =
		keys.length === 0
			? Object.values(deps.registry)
			: keys.map((key) => {
					const definition = deps.registry[key];

					if (definition === undefined) {
						throw new Error(`no operation named "${key}" is registered`);
					}

					return definition;
				});

	if (selected.length === 0) {
		deps.logger.info("no operations are registered");
		return true;
	}

	let allPassed = true;

	for (const definition of selected) {
		const finished = await runOperation(
			{ db: deps.db, logger: deps.logger, signal },
			definition,
		);

		allPassed &&= finished.status === "passed";
	}

	return allPassed;
}

/**
 * Write one operation's outcome and findings to stdout as JSON.
 *
 * stdout rather than the log, so `kubectl logs` output can be piped into
 * something that reads it. The log carries pino's own envelope, which a
 * consumer would then have to unwrap a document out of.
 */
async function exportOperation(deps: Deps, key: string): Promise<boolean> {
	const definition = deps.registry[key];

	if (definition === undefined) {
		throw new Error(`no operation named "${key}" is registered`);
	}

	const row = await getOperation(deps.db, key, definition.version);

	if (row === undefined) {
		process.stdout.write(
			`${JSON.stringify({ key, version: definition.version, status: "never_run" }, null, 2)}\n`,
		);

		return false;
	}

	const findings = await listOperationFindings(deps.db, row.id);

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
async function dispatch(
	deps: Deps,
	signal: AbortSignal,
	argv: readonly string[],
): Promise<boolean> {
	const [command, ...rest] = argv;

	switch (command) {
		case "list":
			await list(deps);
			return true;
		case "run":
			return run(deps, signal, rest);
		case "export": {
			const [key] = rest;

			if (key === undefined) {
				throw new Error("export needs the key of an operation");
			}

			return exportOperation(deps, key);
		}
		default:
			throw new Error(
				`unknown operations command ${command ? `"${command}"` : "(none)"}; expected one of list, run, export`,
			);
	}
}

async function doOperations(argv: readonly string[]): Promise<void> {
	const env = OperationsEnv.parse(
		resolveFileBacked(OPERATIONS_ENV_KEYS, process.env),
	);

	const logger = createLogger({ name: SERVICE });

	// One connection, because the run lock is session-level and has to be taken
	// and released on the same backend for the whole run.
	const { client, db } = createDb(
		{ postgresUrl: env.VT_POSTGRES_URL, postgresPoolMax: 1 },
		SERVICE,
	);

	const controller = new AbortController();

	// A Job that is evicted mid-migration must stop at a batch boundary rather
	// than be killed inside one: the attempt is then recorded as errored with
	// its resume point intact, and the retry continues from there.
	function abort(): void {
		logger.warn("received a termination signal; stopping at the next batch");
		controller.abort();
	}

	process.once("SIGTERM", abort);
	process.once("SIGINT", abort);

	try {
		const deps: Deps = { db, logger, registry: OPERATIONS };

		if (argv[0] === "run" && !(await acquireOperationsLock(client))) {
			logger.error(
				"another migration or operations run holds the lock; not running operations",
			);
			process.exitCode = 1;
			return;
		}

		try {
			if (!(await dispatch(deps, controller.signal, argv))) {
				process.exitCode = 1;
			}
		} finally {
			if (argv[0] === "run") {
				await releaseOperationsLock(client);
			}
		}
	} finally {
		process.off("SIGTERM", abort);
		process.off("SIGINT", abort);
		await client.end();
	}
}

/**
 * Inspect and run database operations — the `operations` subcommand.
 *
 * A function rather than module-scope side effects so the merged binary's
 * dispatcher decides when it runs, and so importing this module costs nothing.
 */
export async function startOperations(argv: readonly string[]): Promise<void> {
	try {
		await doOperations(argv);
	} catch (err) {
		createLogger({ name: SERVICE }).fatal({ err }, "failed to run operations");
		process.exitCode = 1;
	}
}
