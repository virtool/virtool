import { fileURLToPath } from "node:url";
import { resolveFileBacked } from "@virtool/contracts/env";
import { createDb } from "@virtool/data/db/pg";
import { createLogger } from "@virtool/logger";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { z } from "zod";

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

async function main(): Promise<void> {
	const env = MigrateEnv.parse(
		resolveFileBacked(MIGRATE_ENV_KEYS, process.env),
	);

	const logger = createLogger({ name: SERVICE });

	const migrationsFolder = env.VT_MIGRATIONS_PATH ?? DEFAULT_MIGRATIONS_PATH;

	// One connection: migrations are serial by construction, and a pool would
	// leave idle backends open for the length of a DDL statement that may hold
	// locks the rest of the fleet is waiting on.
	const { client, db } = createDb(
		{ postgresUrl: env.VT_POSTGRES_URL, postgresPoolMax: 1 },
		SERVICE,
	);

	try {
		logger.info({ migrationsFolder }, "applying migrations");

		/*
		 The table and schema are pinned to the same values `drizzle.config.ts`
		 sets, and to the ones production's baseline row was stamped into by hand.
		 They are drizzle-orm's defaults today; naming them here means a default
		 moving on either side cannot orphan that stamp and re-run `0000` against a
		 database that already has every table in it.
		*/
		await migrate(db, {
			migrationsFolder,
			migrationsSchema: "drizzle",
			migrationsTable: "__drizzle_migrations",
		});

		logger.info("migrations applied");
	} finally {
		await client.end();
	}
}

try {
	await main();
} catch (err) {
	createLogger({ name: SERVICE }).fatal({ err }, "failed to apply migrations");
	process.exitCode = 1;
}
