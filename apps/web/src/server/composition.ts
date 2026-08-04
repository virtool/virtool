import {
	createDb,
	type Db,
	logPostgresVersion,
	type PgClient,
} from "@virtool/data/db/pg";
import { createEmitter } from "@virtool/data/events/emit";
import { createStorageBackend, type StorageBackend } from "@virtool/storage";
import { config } from "./config";
import { logger } from "./logger";

/**
 * The composition root: the process-wide singletons built once at startup from
 * `config`.
 *
 * `@virtool/storage` and `@virtool/data` take their dependencies as arguments
 * and construct nothing at import time, which is what lets the jobs API and the
 * workflow ports reuse them. Somebody still has to do the construction, and
 * this is where it happens for the web app.
 *
 * **Pass these into `data.ts` functions as arguments.** A `data.ts` module must
 * never import from here — that would put the app's configuration back inside
 * the package's call graph.
 */
export const storage: StorageBackend = createStorageBackend(config.storage);

const handles = createDb(config);

/** The postgres-js connection pool for this process. */
export const client: PgClient = handles.client;

/** The Drizzle handle over {@link client}. */
export const db: Db = handles.db;

/**
 * The name this process's backends connect under, which is how `/metrics` picks
 * its own pool out of `pg_stat_activity`.
 */
export const applicationName: string = handles.applicationName;

logPostgresVersion(client, logger);

createEmitter({ client, logger });
