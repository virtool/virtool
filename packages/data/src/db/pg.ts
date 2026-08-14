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
	 * way to observe pool occupancy: postgres.js exposes no pool statistics. It
	 * carries the hostname and the service so each replica of each service counts
	 * only its own backends.
	 */
	applicationName: string;
};

/**
 * Seconds a pooled connection may sit idle before it is closed.
 *
 * Comfortably under any common idle-drop window — an NLB's 350, a NAT table's
 * 300 — so an idle connection is retired here rather than severed elsewhere and
 * found broken on the next query.
 */
const IDLE_TIMEOUT_SECONDS = 60;

/**
 * Open a connection pool and the Drizzle handle over it.
 *
 * Call this once, at a composition root. Nothing in this package opens a pool
 * at import time, which is what lets every service reuse the data layer without
 * inheriting the web app's configuration.
 *
 * `service` names the calling process — `"web"`, `"jobs-api"` — and reaches
 * Postgres as part of `application_name`. It is a second argument rather than a
 * {@link DbConfig} field because it is a fact about the process, not something
 * read from the environment.
 */
export function createDb(config: DbConfig, service: string): DbHandles {
	const applicationName = buildApplicationName(service, hostname());

	const client = postgres(config.postgresUrl, {
		max: config.postgresPoolMax,
		idle_timeout: IDLE_TIMEOUT_SECONDS,
		connection: { application_name: applicationName },
	});

	return { client, db: drizzle(client, { schema }), applicationName };
}

/**
 * Report the version of the connected Postgres, once, at startup.
 *
 * Kept out of {@link createDb} so opening a pool costs no round trip.
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
