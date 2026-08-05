import { resolveFileBacked } from "@virtool/contracts/env";

/** Everything this process reads from the environment at startup. */
export type Config = {
	host: string;
	port: number;
	postgresUrl: string;
	postgresPoolMax: number;
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
		metricsToken: present(resolved.VT_METRICS_TOKEN),
		sentryDsn: present(resolved.VT_SENTRY_DSN),
	};
}
