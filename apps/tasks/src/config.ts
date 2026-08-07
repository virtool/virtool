import { resolveFileBacked } from "@virtool/contracts/env";
import type { StorageConfig } from "@virtool/storage";
import { z } from "zod";

/** postgres-js pool size when `VT_POSTGRES_POOL_MAX` is unset. */
const DEFAULT_POSTGRES_POOL_MAX = 10;

/**
 * Port the probe and metrics listener binds when `VT_TASKS_PROBE_PORT` is
 * unset.
 *
 * The value is arbitrary — this process serves no traffic and has no Service —
 * but it is hardcoded in the deployment manifests, so it is fixed here and
 * documented rather than left to drift.
 */
const DEFAULT_PROBE_PORT = 9900;

/**
 * Seconds the shutdown sequence may take before the backstop gives up, when
 * `VT_TASKS_SHUTDOWN_TIMEOUT` is unset.
 *
 * It must sit strictly under `terminationGracePeriodSeconds`, which covers
 * `preStop` and shutdown combined. The manifests use a 60 s grace period behind
 * a 10 s `preStop` sleep, leaving 50 s; 30 s is comfortably inside that, so an
 * overrun is reported by this process rather than cut short by SIGKILL.
 */
const DEFAULT_SHUTDOWN_TIMEOUT = 30;

/** Everything this process reads from the environment at startup. */
export type TasksConfig = {
	postgresUrl: string;
	postgresPoolMax: number;
	probePort: number;
	/** Seconds the shutdown sequence may run before the backstop gives up. */
	shutdownTimeout: number;
	/**
	 * Whether this process claims and runs tasks.
	 *
	 * Set to `false` to deploy the spawner half alone, which is how the
	 * TypeScript runner reaches production ahead of the cutover from Python: one
	 * deployment spawns periodic tasks while Python still runs them, and flipping
	 * this to `true` is the cutover. Defaults to `true`, so an omitted key fails
	 * toward a working fleet rather than a silent no-op one.
	 */
	claimEnabled: boolean;
	/**
	 * Whether this process spawns periodic tasks.
	 *
	 * Every replica carries the spawner, so this exists to turn it off — during
	 * the cutover window, when Python is still spawning the same periodic tasks
	 * and two spawners would duplicate them.
	 */
	spawnEnabled: boolean;
	/**
	 * Gates the Prometheus scrape endpoint. Unset leaves `/metrics` reporting
	 * 404, so a deployment never starts exposing internals on upgrade.
	 */
	metricsToken: string | undefined;
	/** Unset disables Sentry entirely, which is what dev and CI want. */
	sentryDsn: string | undefined;
	storage: StorageConfig;
};

// Deployment tooling routinely injects an empty string for a value it has
// nothing to put in. Treat that as unset everywhere, so a default applies
// rather than an empty credential being sent as a literal.
function optional() {
	return z.preprocess(
		(value) => (value === "" ? undefined : value),
		z.string().optional(),
	);
}

/**
 * Read a `VT_`-prefixed boolean.
 *
 * Spelled out rather than deferring to `z.coerce.boolean()`, which is a plain
 * truthiness cast: it reads the string `"false"` as `true`, so the one value a
 * deployment is most likely to write in order to turn something off would turn
 * it on instead.
 */
function boolish(fallback: boolean) {
	return z.preprocess(
		(value) => (value === "" || value === undefined ? undefined : value),
		z
			.enum(["true", "false", "1", "0"])
			.optional()
			.transform((value) =>
				value === undefined ? fallback : value === "true" || value === "1",
			),
	);
}

const TasksEnv = z.object({
	VT_POSTGRES_URL: z.string().url(),
	// Deployment tooling routinely injects an empty string for a value it has
	// nothing to put in; treat that as unset so the default applies rather than
	// coercing "" to 0 and failing the `.positive()` check at startup.
	VT_POSTGRES_POOL_MAX: z.preprocess(
		(value) => (value === "" ? undefined : value),
		z.coerce.number().int().positive().optional(),
	),
	VT_TASKS_PROBE_PORT: z.preprocess(
		(value) => (value === "" ? undefined : value),
		z.coerce.number().int().positive().optional(),
	),
	VT_TASKS_SHUTDOWN_TIMEOUT: z.preprocess(
		(value) => (value === "" ? undefined : value),
		z.coerce.number().int().positive().optional(),
	),
	VT_TASKS_CLAIM_ENABLED: boolish(true),
	VT_TASKS_SPAWN_ENABLED: boolish(true),
	VT_METRICS_TOKEN: optional(),
	// Listed here so it picks up the `<KEY>_FILE` resolution every other key
	// gets. `@virtool/sentry`'s `readDsn` goes straight to `process.env` and
	// would miss a `VT_SENTRY_DSN_FILE` mount, so the DSN is resolved here and
	// passed to `Sentry.init` explicitly instead.
	VT_SENTRY_DSN: optional(),
	VT_STORAGE_BACKEND: z.enum(["s3", "azure"]),
	VT_STORAGE_S3_BUCKET: optional(),
	VT_STORAGE_S3_REGION: optional(),
	VT_STORAGE_S3_ENDPOINT: optional(),
	VT_STORAGE_S3_ACCESS_KEY_ID: optional(),
	VT_STORAGE_S3_SECRET_ACCESS_KEY: optional(),
	VT_STORAGE_AZURE_ACCOUNT: optional(),
	VT_STORAGE_AZURE_CONTAINER: optional(),
	VT_STORAGE_AZURE_ACCESS_KEY: optional(),
	VT_STORAGE_AZURE_ENDPOINT: optional(),
});

type TasksEnvValues = z.infer<typeof TasksEnv>;

function requirePresent(
	ctx: z.RefinementCtx,
	key: keyof TasksEnvValues,
	value: string | undefined,
	backend: string,
): boolean {
	if (value) {
		return true;
	}

	ctx.addIssue({
		code: "custom",
		path: [key],
		message: `${key} is required when VT_STORAGE_BACKEND=${backend}`,
	});

	return false;
}

function buildStorage(
	raw: TasksEnvValues,
	ctx: z.RefinementCtx,
): StorageConfig {
	if (raw.VT_STORAGE_BACKEND === "s3") {
		const accessKeyId = raw.VT_STORAGE_S3_ACCESS_KEY_ID;
		const secretAccessKey = raw.VT_STORAGE_S3_SECRET_ACCESS_KEY;

		let ok = requirePresent(
			ctx,
			"VT_STORAGE_S3_BUCKET",
			raw.VT_STORAGE_S3_BUCKET,
			"s3",
		);

		// Both empty means the AWS credential chain supplies an IAM role. Exactly
		// one set is always a mistake, and silently ignoring the odd one out would
		// send the process to production authenticating as the wrong principal.
		if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
			ctx.addIssue({
				code: "custom",
				path: ["VT_STORAGE_S3_ACCESS_KEY_ID"],
				message:
					"VT_STORAGE_S3_ACCESS_KEY_ID and VT_STORAGE_S3_SECRET_ACCESS_KEY must be set together, or both left empty to use IAM role credentials",
			});
			ok = false;
		}

		if (!ok) {
			return z.NEVER;
		}

		return {
			kind: "s3",
			bucket: raw.VT_STORAGE_S3_BUCKET as string,
			region: raw.VT_STORAGE_S3_REGION,
			// Left unset for real AWS, which the SDK resolves from the region.
			endpoint: raw.VT_STORAGE_S3_ENDPOINT,
			accessKeyId,
			secretAccessKey,
		};
	}

	const hasAccount = requirePresent(
		ctx,
		"VT_STORAGE_AZURE_ACCOUNT",
		raw.VT_STORAGE_AZURE_ACCOUNT,
		"azure",
	);
	const hasContainer = requirePresent(
		ctx,
		"VT_STORAGE_AZURE_CONTAINER",
		raw.VT_STORAGE_AZURE_CONTAINER,
		"azure",
	);

	if (!hasAccount || !hasContainer) {
		return z.NEVER;
	}

	return {
		kind: "azure",
		account: raw.VT_STORAGE_AZURE_ACCOUNT as string,
		container: raw.VT_STORAGE_AZURE_CONTAINER as string,
		accessKey: raw.VT_STORAGE_AZURE_ACCESS_KEY,
		endpoint: raw.VT_STORAGE_AZURE_ENDPOINT,
	};
}

const TasksEnvSchema = TasksEnv.transform((raw, ctx) => ({
	postgresUrl: raw.VT_POSTGRES_URL,
	postgresPoolMax: raw.VT_POSTGRES_POOL_MAX ?? DEFAULT_POSTGRES_POOL_MAX,
	probePort: raw.VT_TASKS_PROBE_PORT ?? DEFAULT_PROBE_PORT,
	shutdownTimeout: raw.VT_TASKS_SHUTDOWN_TIMEOUT ?? DEFAULT_SHUTDOWN_TIMEOUT,
	claimEnabled: raw.VT_TASKS_CLAIM_ENABLED,
	spawnEnabled: raw.VT_TASKS_SPAWN_ENABLED,
	metricsToken: raw.VT_METRICS_TOKEN,
	sentryDsn: raw.VT_SENTRY_DSN,
	storage: buildStorage(raw, ctx),
}));

/**
 * Every environment key this process reads.
 *
 * Derived from the schema rather than listed by hand, because the `<KEY>_FILE`
 * resolution below walks it: a key missing from this list silently loses its
 * file variant and reads only the plain environment. `config.test.ts` asserts
 * every entry carries the `VT_` prefix.
 */
export const TASKS_ENV_KEYS: string[] = Object.keys(TasksEnv.shape);

/**
 * Resolve this process's configuration from the environment.
 *
 * A function rather than a module-scope constant, and the whole reason this app
 * has no configuration singleton: `bootstrap` calls it, everything downstream
 * receives the result as an argument. Importing any module in this app must not
 * force an environment parse.
 *
 * Every key also accepts a `<KEY>_FILE` variant naming a file to read the value
 * from, via the resolver shared with `apps/web` and `apps/jobs-api` in
 * `@virtool/contracts/env`. It is imported rather than copied so the precedence
 * rule — the file wins over a plain variable of the same name — cannot drift
 * between the three services.
 */
export function parseTasksConfig(
	env: NodeJS.ProcessEnv = process.env,
): TasksConfig {
	return TasksEnvSchema.parse(resolveFileBacked(TASKS_ENV_KEYS, env));
}
