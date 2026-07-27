import { hostname } from "node:os";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config";
import { logger } from "../logger";
import { buildApplicationName } from "./applicationName";
import * as schema from "./schema";

/**
 * Identifies this process's backends in `pg_stat_activity`, which is the only
 * way to observe pool occupancy: postgres.js keeps its connection queues in a
 * closure and exposes no pool statistics.
 *
 * The hostname is part of it so each replica counts its own pool rather than
 * every Virtool process sharing the database. Without it, every replica would
 * report the same cluster-wide total and summing the series would multiply it.
 */
export const applicationName = buildApplicationName(hostname());

export const client = postgres(config.postgresUrl, {
	max: config.postgresPoolMax,
	connection: { application_name: applicationName },
});

export const db = drizzle(client, { schema });

/** Drizzle database client typed against the full schema. */
export type Db = typeof db;

/** A Drizzle transaction handle, as passed to a `db.transaction` callback. */
export type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Either the pooled database handle or an open transaction. */
export type DbOrTx = Db | Transaction;

/** The underlying postgres-js client used by Drizzle. */
export type PgClient = typeof client;

void client`SHOW server_version`.then(
	(rows) => {
		const version = String(rows[0]?.server_version ?? "").split(/\s+/)[0];
		logger.info({ version }, "found postgres");
	},
	(err) => {
		logger.warn({ err }, "could not read postgres server version");
	},
);
