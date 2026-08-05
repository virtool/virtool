import { readFileSync } from "node:fs";

/** Everything this process reads from the environment at startup. */
export type Config = {
	host: string;
	port: number;
	postgresUrl: string;
	postgresPoolMax: number;
};

/**
 * Read `<key>`, preferring the contents of the file named by `<key>_FILE`.
 *
 * The file wins over a plain variable of the same name: a rollout moving to a
 * secrets-store mount can still carry the stale variable from the `Secret` it
 * replaces, and erroring on the overlap would crashloop the rollout that fixes
 * it.
 */
function read(key: string): string | undefined {
	const path = process.env[`${key}_FILE`];

	if (path) {
		return readFileSync(path, "utf8").trim();
	}

	return process.env[key];
}

function requireEnv(key: string): string {
	const value = read(key);

	if (!value) {
		throw new Error(`${key} is required`);
	}

	return value;
}

function readNumber(key: string, fallback: number): number {
	const value = read(key);

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
 * The port mirrors Python's jobs API, which serves on 9950 as
 * `api-jobs-service`, so the two can be swapped behind the same ClusterIP.
 */
export function readConfig(): Config {
	return {
		host: read("VT_JOBS_API_HOST") ?? "0.0.0.0",
		port: readNumber("VT_JOBS_API_PORT", 9950),
		postgresUrl: requireEnv("VT_POSTGRES_URL"),
		postgresPoolMax: readNumber("VT_POSTGRES_POOL_MAX", 10),
	};
}
