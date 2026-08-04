import { hostname } from "node:os";
import type { Logger } from "@virtool/logger";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { buildApplicationName } from "./applicationName";
import * as schema from "./schema";

/** Drizzle database client typed against the full schema. */
export type Db = ReturnType<typeof drizzle<typeof schema>>;

/** A Drizzle transaction handle, as passed to a `db.transaction` callback. */
export type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Either the pooled database handle or an open transaction. */
export type DbOrTx = Db | Transaction;

/** The underlying postgres-js client used by Drizzle. */
export type PgClient = postgres.Sql;

/** What {@link createDb} needs to open a pool. */
export type DbConfig = {
	postgresUrl: string;
	postgresPoolMax: number;
};

/** The pool, the Drizzle handle over it, and the name it connects under. */
export type DbHandles = {
	client: PgClient;
	db: Db;
	/**
	 * Identifies this process's backends in `pg_stat_activity`, which is the only
	 * way to observe pool occupancy: postgres.js keeps its connection queues in a
	 * closure and exposes no pool statistics.
	 *
	 * The hostname is part of it so each replica counts its own pool rather than
	 * every Virtool process sharing the database. Without it, every replica would
	 * report the same cluster-wide total and summing the series would multiply it.
	 */
	applicationName: string;
};

/**
 * Open a connection pool and the Drizzle handle over it.
 *
 * Call this once, at a composition root. Nothing in this package opens a pool
 * at import time — that is what lets the jobs API and the workflow ports reuse
 * the data layer without inheriting the web app's configuration.
 */
export function createDb(config: DbConfig): DbHandles {
	const applicationName = buildApplicationName(hostname());

	const client = postgres(config.postgresUrl, {
		max: config.postgresPoolMax,
		connection: { application_name: applicationName },
	});

	return { client, db: drizzle(client, { schema }), applicationName };
}

/**
 * Report the version of the connected Postgres, once, at startup.
 *
 * Kept out of {@link createDb} so opening a pool costs no round trip: a caller
 * that only wants a handle — a test, a short-lived script — should not have to
 * wait on, or log, a `SHOW`.
 */
export function logPostgresVersion(client: PgClient, logger: Logger): void {
	void client`SHOW server_version`.then(
		(rows) => {
			const version = String(rows[0]?.server_version ?? "").split(/\s+/)[0];
			logger.info({ version }, "found postgres");
		},
		(err) => {
			logger.warn({ err }, "could not read postgres server version");
		},
	);
}
