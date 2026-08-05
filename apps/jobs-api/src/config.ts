import { resolveFileBacked } from "@virtool/contracts/env";
import type { StorageConfig } from "@virtool/storage";

/** Everything this process reads from the environment at startup. */
export type Config = {
	host: string;
	port: number;
	postgresUrl: string;
	postgresPoolMax: number;
	/**
	 * The same bucket Python and `apps/web` use. Cache registration reads an
	 * object's size from it before writing a row, so this service cannot start
	 * without it.
	 */
	storage: StorageConfig;
	/**
	 * Gates the Prometheus scrape endpoint. Unset leaves `/metrics` reporting
	 * 404, so a deployment never starts exposing internals on upgrade.
	 */
	metricsToken: string | undefined;
	/** Unset disables Sentry entirely, which is what dev and CI want. */
	sentryDsn: string | undefined;
};

/**
 * Every key this process reads.
 *
 * Named explicitly rather than derived, because the `<KEY>_FILE` resolution
 * below walks this list: a key missing from it silently loses its file variant
 * and reads only the plain environment.
 *
 * `VT_SENTRY_DSN` is here even though `@virtool/sentry` can read it itself.
 * `readDsn` goes straight to `process.env` and so would skip the file variant;
 * the DSN is resolved here and passed to `Sentry.init` explicitly instead.
 */
const KEYS = [
	"VT_JOBS_API_HOST",
	"VT_JOBS_API_PORT",
	"VT_POSTGRES_URL",
	"VT_POSTGRES_POOL_MAX",
	"VT_METRICS_TOKEN",
	"VT_SENTRY_DSN",
	"VT_STORAGE_BACKEND",
	"VT_STORAGE_S3_BUCKET",
	"VT_STORAGE_S3_REGION",
	"VT_STORAGE_S3_ENDPOINT",
	"VT_STORAGE_S3_ACCESS_KEY_ID",
	"VT_STORAGE_S3_SECRET_ACCESS_KEY",
	"VT_STORAGE_AZURE_ACCOUNT",
	"VT_STORAGE_AZURE_CONTAINER",
	"VT_STORAGE_AZURE_ACCESS_KEY",
	"VT_STORAGE_AZURE_ENDPOINT",
] as const;

// Deployment tooling routinely injects an empty string for a value it has
// nothing to put in. Treat that as unset everywhere, so a default applies
// rather than an empty credential being sent as a literal.
function present(value: string | undefined): string | undefined {
	return value ? value : undefined;
}

function requireValue(
	env: NodeJS.ProcessEnv,
	key: (typeof KEYS)[number],
): string {
	const value = present(env[key]);

	if (!value) {
		throw new Error(`${key} is required`);
	}

	return value;
}

function readNumber(
	env: NodeJS.ProcessEnv,
	key: (typeof KEYS)[number],
	fallback: number,
): number {
	const value = present(env[key]);

	if (!value) {
		return fallback;
	}

	const parsed = Number(value);

	if (!Number.isInteger(parsed) || parsed < 1) {
		throw new Error(`${key} must be a positive integer`);
	}

	return parsed;
}

/**
 * Build the storage configuration this process hands to
 * `createStorageBackend`.
 *
 * `@virtool/storage` owns the shape but reads no environment of its own, so
 * each host application resolves it. This is a hand-rolled counterpart to the
 * zod schema in `apps/web/src/server/config.ts` rather than a shared parser:
 * this service deliberately carries no zod, and the two only have to agree on
 * the variable names, which are the deployment's contract either way.
 */
function buildStorage(resolved: NodeJS.ProcessEnv): StorageConfig {
	const backend = present(resolved.VT_STORAGE_BACKEND);

	if (backend !== "s3" && backend !== "azure") {
		throw new Error("VT_STORAGE_BACKEND must be one of: s3, azure");
	}

	if (backend === "s3") {
		const accessKeyId = present(resolved.VT_STORAGE_S3_ACCESS_KEY_ID);
		const secretAccessKey = present(resolved.VT_STORAGE_S3_SECRET_ACCESS_KEY);

		// Both or neither. One alone is a half-configured deployment that would
		// otherwise fall back to instance credentials and fail later, at the first
		// request, rather than at startup.
		if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
			throw new Error(
				"VT_STORAGE_S3_ACCESS_KEY_ID and VT_STORAGE_S3_SECRET_ACCESS_KEY must be set together, or both left empty to use IAM role credentials",
			);
		}

		return {
			kind: "s3",
			bucket: requireValue(resolved, "VT_STORAGE_S3_BUCKET"),
			region: present(resolved.VT_STORAGE_S3_REGION),
			// Left unset for real AWS, which the SDK resolves from the region.
			endpoint: present(resolved.VT_STORAGE_S3_ENDPOINT),
			accessKeyId,
			secretAccessKey,
		};
	}

	return {
		kind: "azure",
		account: requireValue(resolved, "VT_STORAGE_AZURE_ACCOUNT"),
		container: requireValue(resolved, "VT_STORAGE_AZURE_CONTAINER"),
		accessKey: present(resolved.VT_STORAGE_AZURE_ACCESS_KEY),
		endpoint: present(resolved.VT_STORAGE_AZURE_ENDPOINT),
	};
}

/**
 * Resolve configuration from the environment.
 *
 * Every key also accepts a `<KEY>_FILE` variant naming a file to read the value
 * from, via the resolver shared with `apps/web` in `@virtool/contracts/env`. It
 * is imported rather than copied so the precedence rule — the file wins over a
 * plain variable of the same name — cannot drift between the two services.
 *
 * The port mirrors Python's jobs API, which serves on 9950 as
 * `api-jobs-service`, so the two can be swapped behind the same ClusterIP.
 */
export function parseConfig(env: NodeJS.ProcessEnv = process.env): Config {
	const resolved = resolveFileBacked(KEYS, env);

	return {
		host: present(resolved.VT_JOBS_API_HOST) ?? "0.0.0.0",
		port: readNumber(resolved, "VT_JOBS_API_PORT", 9950),
		postgresUrl: requireValue(resolved, "VT_POSTGRES_URL"),
		postgresPoolMax: readNumber(resolved, "VT_POSTGRES_POOL_MAX", 10),
		storage: buildStorage(resolved),
		metricsToken: present(resolved.VT_METRICS_TOKEN),
		sentryDsn: present(resolved.VT_SENTRY_DSN),
	};
}
