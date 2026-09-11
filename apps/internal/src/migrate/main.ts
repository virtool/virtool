import { fileURLToPath } from "node:url";
import { resolveFileBacked } from "@virtool/contracts/env";
import {
	acquireDataMigrationsLock,
	releaseDataMigrationsLock,
} from "@virtool/data/data-migrations/data";
import { createLogger } from "@virtool/logger";
import { z } from "zod";

import { DATA_MIGRATIONS } from "../data-migrations/registry";
import { applyGatedMigrations } from "./apply";
import { createMigrationDb } from "./connection";

/**
 * The name this entrypoint reports under, in logs and in `application_name`.
 *
 * Deliberately not `tasks`: this process shares the image but not the job, and
 * telling the two apart in `pg_stat_activity` is how a migration holding a lock
 * is distinguished from a runner holding one.
 */
const SERVICE = "migrate";

/**
 * Where the migrations live when `VT_MIGRATIONS_PATH` is unset.
 *
 * Relative to the bundle rather than to the working directory, so the Job needs
 * no `workingDir`. `pnpm deploy` carries only `dist` and `node_modules`, so the
 * Dockerfile copies `packages/data/drizzle` alongside them.
 */
const DEFAULT_MIGRATIONS_PATH = fileURLToPath(
	new URL("../drizzle", import.meta.url),
);

/*
 A schema of its own rather than `parseTasksConfig`, which demands storage
 credentials, a probe port and the shutdown budget — none of which a migration
 has any use for, and all of which the Job's pod spec would then have to carry.
 `resolveFileBacked` is the shared resolver, so `VT_POSTGRES_URL_FILE` works
 here exactly as it does for the service.
*/
const MigrateEnv = z.object({
	VT_POSTGRES_URL: z.string().url(),
	// The seam that lets this run outside the image, against a scratch database
	// and the working tree's own `packages/data/drizzle`.
	VT_MIGRATIONS_PATH: z.preprocess(
		(value) => (typeof value === "string" ? value.trim() || undefined : value),
		z.string().optional(),
	),
});

/** Every environment key this entrypoint reads. */
const MIGRATE_ENV_KEYS: string[] = Object.keys(MigrateEnv.shape);

async function doMigrate(): Promise<void> {
	const env = MigrateEnv.parse(
		resolveFileBacked(MIGRATE_ENV_KEYS, process.env),
	);

	const logger = createLogger({ name: SERVICE });

	const migrationsFolder = env.VT_MIGRATIONS_PATH ?? DEFAULT_MIGRATIONS_PATH;

	const controller = new AbortController();
	const { client, db } = createMigrationDb(env.VT_POSTGRES_URL, controller);
	function abort(): void {
		logger.warn("stopping migrations at the next boundary");
		controller.abort();
	}
	process.once("SIGTERM", abort);
	process.once("SIGINT", abort);

	try {
		if (!(await acquireDataMigrationsLock(client))) {
			logger.error(
				"another migration run holds the lock; not applying migrations",
			);
			process.exitCode = 1;
			return;
		}

		try {
			logger.info({ migrationsFolder }, "applying migrations");

			/*
			 The table and schema are pinned to the same values `drizzle.config.ts`
			 sets, and to the ones production's baseline row was stamped into by
			 hand. They are drizzle-orm's defaults today; naming them here means a
			 default moving on either side cannot orphan that stamp and re-run
			 `0000` against a database that already has every table in it.
			*/
			const result = await applyGatedMigrations({
				db,
				client,
				signal: controller.signal,
				logger,
				migrationsFolder,
				migrationsSchema: "drizzle",
				migrationsTable: "__drizzle_migrations",
				registry: DATA_MIGRATIONS,
			});

			if (result.blockedAt === undefined) {
				logger.info(
					{ applied_through: result.appliedThrough },
					"migrations applied",
				);
				return;
			}

			logger.error(
				{
					blocked_at: result.blockedAt,
					applied_through: result.appliedThrough,
					...result.outcome,
				},
				"data migration did not pass; inspect its findings, remediate, and rerun migrate",
			);

			process.exitCode = 1;
		} finally {
			await releaseDataMigrationsLock(client);
		}
	} finally {
		process.off("SIGTERM", abort);
		process.off("SIGINT", abort);
		await client.end();
	}
}

/** Apply pending SQL and paired data migrations, stopping at the first failed attempt. */
export async function startMigrate(): Promise<void> {
	try {
		await doMigrate();
	} catch (err) {
		createLogger({ name: SERVICE }).fatal(
			{ err },
			"failed to apply migrations",
		);
		process.exitCode = 1;
	}
}
