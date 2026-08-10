import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseConfig } from "./config";

let directory: string;

beforeAll(() => {
	directory = mkdtempSync(join(tmpdir(), "virtool-jobs-api-config-"));
});

afterAll(() => {
	rmSync(directory, { recursive: true, force: true });
});

/** Write `content` to a file in the temp directory and return its path. */
function writeSecret(name: string, content: string): string {
	const path = join(directory, name);
	writeFileSync(path, content, "utf8");
	return path;
}

/** Rewrite every entry of `env` as its `<KEY>_FILE` variant. */
function asFileBacked(env: Record<string, string>): NodeJS.ProcessEnv {
	return Object.fromEntries(
		Object.entries(env).map(([key, value]) => [
			`${key}_FILE`,
			writeSecret(`file-backed-${key}`, `${value}\n`),
		]),
	);
}

/** The smallest environment that parses, for a test to add one key to. */
function baseEnv(): NodeJS.ProcessEnv {
	return {
		VT_POSTGRES_URL: "postgres://virtool:virtool@localhost:5432/virtool",
		VT_STORAGE_BACKEND: "s3",
		VT_STORAGE_S3_BUCKET: "virtool",
	};
}

/**
 * An environment setting every key this parser reads, with the S3 backend
 * selected.
 *
 * Every value differs from the default it would fall back to, so a key that
 * failed to resolve shows up as a difference in the parsed config rather than
 * as a value that happens to match.
 */
const S3_ENV: Record<string, string> = {
	VT_JOBS_API_HOST: "10.0.0.1",
	VT_JOBS_API_PORT: "19950",
	VT_JOBS_API_SHUTDOWN_TIMEOUT: "45",
	VT_POSTGRES_URL: "postgres://virtool:virtool@db:5432/virtool",
	VT_POSTGRES_POOL_MAX: "25",
	VT_METRICS_TOKEN: "a-metrics-token",
	VT_SENTRY_DSN: "https://public@sentry.example.com/1",
	VT_STORAGE_BACKEND: "s3",
	VT_STORAGE_S3_BUCKET: "a-bucket",
	VT_STORAGE_S3_REGION: "us-east-1",
	VT_STORAGE_S3_ENDPOINT: "https://s3.example.com",
	VT_STORAGE_S3_ACCESS_KEY_ID: "an-access-key-id",
	VT_STORAGE_S3_SECRET_ACCESS_KEY: "a-secret-access-key",
};

/** The same, with the Azure backend selected. */
const AZURE_ENV: Record<string, string> = {
	VT_JOBS_API_HOST: "10.0.0.1",
	VT_JOBS_API_PORT: "19950",
	VT_JOBS_API_SHUTDOWN_TIMEOUT: "45",
	VT_POSTGRES_URL: "postgres://virtool:virtool@db:5432/virtool",
	VT_POSTGRES_POOL_MAX: "25",
	VT_METRICS_TOKEN: "a-metrics-token",
	VT_SENTRY_DSN: "https://public@sentry.example.com/1",
	VT_STORAGE_BACKEND: "azure",
	VT_STORAGE_AZURE_ACCOUNT: "an-account",
	VT_STORAGE_AZURE_CONTAINER: "a-container",
	VT_STORAGE_AZURE_ACCESS_KEY: "an-access-key",
	VT_STORAGE_AZURE_ENDPOINT: "https://blob.example.com",
};

const SOURCE = readFileSync(new URL("./config.ts", import.meta.url), "utf8");

/** Every first capture group `pattern` finds in `source`. */
function matchKeys(source: string, pattern: RegExp): string[] {
	const keys: string[] = [];

	for (const match of source.matchAll(pattern)) {
		const [, key] = match;

		if (key) {
			keys.push(key);
		}
	}

	return keys;
}

/**
 * The keys `KEYS` declares, and the keys `parseConfig` actually reads.
 *
 * Read out of the source because `KEYS` is private and, more to the point,
 * because the mistake worth catching is a divergence between the two lists that
 * no runtime value exposes. `requireValue` and `readNumber` take
 * `(typeof KEYS)[number]`, so those reads cannot escape the list; a bare
 * `present(resolved.VT_SOMETHING)` can, because `resolved` is a
 * `NodeJS.ProcessEnv` and indexes with any string at all.
 */
function readKeysFromSource(source: string): {
	declared: string[];
	read: string[];
} {
	const declaration = /const KEYS = \[([^\]]*)\] as const;/.exec(source);
	const body = declaration?.[1];

	if (!body) {
		throw new Error("the KEYS declaration was not found in config.ts");
	}

	const read = new Set([
		// `present(resolved.VT_FOO)` — the form that escapes the type.
		...matchKeys(source, /resolved\.(VT_[A-Z0-9_]+)/g),
		// `requireValue(resolved, "VT_FOO")` and `readNumber(resolved, "VT_FOO", …)`.
		...matchKeys(source, /resolved,\s*"(VT_[A-Z0-9_]+)"/g),
	]);

	return {
		declared: matchKeys(body, /"(VT_[A-Z0-9_]+)"/g),
		read: [...read],
	};
}

describe("parseConfig", () => {
	it("parses a minimal environment", () => {
		const config = parseConfig(baseEnv());

		expect(config.postgresUrl).toBe(
			"postgres://virtool:virtool@localhost:5432/virtool",
		);
		expect(config.storage).toEqual({
			kind: "s3",
			bucket: "virtool",
			region: undefined,
			endpoint: undefined,
			accessKeyId: undefined,
			secretAccessKey: undefined,
		});
	});

	it("applies defaults for every omitted optional key", () => {
		const config = parseConfig(baseEnv());

		expect(config.host).toBe("0.0.0.0");
		// Python's jobs API serves on 9950, so the two can be swapped behind the
		// same ClusterIP.
		expect(config.port).toBe(9950);
		expect(config.postgresPoolMax).toBe(10);
		expect(config.shutdownTimeout).toBe(30);
		expect(config.metricsToken).toBeUndefined();
		expect(config.sentryDsn).toBeUndefined();
	});

	it("throws when a required key is missing", () => {
		expect(() => parseConfig({ VT_STORAGE_BACKEND: "s3" })).toThrowError(
			/VT_POSTGRES_URL is required/,
		);
	});

	// Deployment tooling routinely injects an empty string for a value it has
	// nothing to put in. A literal empty credential is worse than none.
	it("treats an injected empty string as unset", () => {
		const config = parseConfig({
			...baseEnv(),
			VT_JOBS_API_HOST: "",
			VT_JOBS_API_PORT: "",
			VT_METRICS_TOKEN: "",
			VT_SENTRY_DSN: "",
		});

		expect(config.host).toBe("0.0.0.0");
		expect(config.port).toBe(9950);
		expect(config.metricsToken).toBeUndefined();
		expect(config.sentryDsn).toBeUndefined();
	});

	it("throws when a required key is present but empty", () => {
		expect(() =>
			parseConfig({ ...baseEnv(), VT_POSTGRES_URL: "" }),
		).toThrowError(/VT_POSTGRES_URL is required/);
	});

	describe("numeric keys", () => {
		it("reads an integer", () => {
			const config = parseConfig({
				...baseEnv(),
				VT_JOBS_API_PORT: "8080",
				VT_POSTGRES_POOL_MAX: "4",
				VT_JOBS_API_SHUTDOWN_TIMEOUT: "15",
			});

			expect(config.port).toBe(8080);
			expect(config.postgresPoolMax).toBe(4);
			expect(config.shutdownTimeout).toBe(15);
		});

		it.each(["0", "-1", "1.5", "9950abc", "abc", " "])(
			"rejects %j",
			(value) => {
				expect(() =>
					parseConfig({ ...baseEnv(), VT_JOBS_API_PORT: value }),
				).toThrowError(/VT_JOBS_API_PORT must be a positive integer/);
			},
		);
	});

	describe("storage", () => {
		it("throws for an unknown backend", () => {
			expect(() =>
				parseConfig({ ...baseEnv(), VT_STORAGE_BACKEND: "gcs" }),
			).toThrowError(/VT_STORAGE_BACKEND must be one of: s3, azure/);
		});

		it("throws when no backend is named", () => {
			expect(() =>
				parseConfig({
					VT_POSTGRES_URL: "postgres://virtool@db:5432/virtool",
				}),
			).toThrowError(/VT_STORAGE_BACKEND must be one of: s3, azure/);
		});

		// One credential alone is a half-configured deployment that would fall back
		// to instance credentials and fail at the first request instead of at
		// startup.
		it("rejects an S3 access key id without its secret", () => {
			expect(() =>
				parseConfig({ ...baseEnv(), VT_STORAGE_S3_ACCESS_KEY_ID: "an-id" }),
			).toThrowError(/must be set together/);
		});

		it("rejects an S3 secret without its access key id", () => {
			expect(() =>
				parseConfig({
					...baseEnv(),
					VT_STORAGE_S3_SECRET_ACCESS_KEY: "a-secret",
				}),
			).toThrowError(/must be set together/);
		});

		it("accepts both S3 credentials together", () => {
			const config = parseConfig({
				...baseEnv(),
				VT_STORAGE_S3_ACCESS_KEY_ID: "an-id",
				VT_STORAGE_S3_SECRET_ACCESS_KEY: "a-secret",
			});

			expect(config.storage).toMatchObject({
				kind: "s3",
				accessKeyId: "an-id",
				secretAccessKey: "a-secret",
			});
		});

		// An empty string is unset, so the pair is still "neither" rather than one
		// empty credential and one missing.
		it("accepts both S3 credentials left empty", () => {
			const config = parseConfig({
				...baseEnv(),
				VT_STORAGE_S3_ACCESS_KEY_ID: "",
				VT_STORAGE_S3_SECRET_ACCESS_KEY: "",
			});

			expect(config.storage).toMatchObject({
				accessKeyId: undefined,
				secretAccessKey: undefined,
			});
		});

		it("requires the azure account and container", () => {
			expect(() =>
				parseConfig({
					VT_POSTGRES_URL: "postgres://virtool@db:5432/virtool",
					VT_STORAGE_BACKEND: "azure",
					VT_STORAGE_AZURE_ACCOUNT: "an-account",
				}),
			).toThrowError(/VT_STORAGE_AZURE_CONTAINER is required/);
		});
	});

	describe("<KEY>_FILE resolution", () => {
		it("reads the value from the named file", () => {
			const config = parseConfig({
				...baseEnv(),
				VT_METRICS_TOKEN_FILE: writeSecret("token", "a-metrics-token"),
			});

			expect(config.metricsToken).toBe("a-metrics-token");
		});

		// The CSI driver's file mount carries whatever the secret store had,
		// trailing newline included. An untrimmed token never matches.
		it("trims the file's contents", () => {
			const config = parseConfig({
				...baseEnv(),
				VT_METRICS_TOKEN_FILE: writeSecret("padded", "  a-metrics-token\n"),
			});

			expect(config.metricsToken).toBe("a-metrics-token");
		});

		// A rollout moving to the mount can still carry the stale env var from the
		// Secret it replaces. Erroring on the overlap would crashloop the very
		// rollout that fixes it.
		it("lets the file win over a plain variable of the same name", () => {
			const config = parseConfig({
				...baseEnv(),
				VT_METRICS_TOKEN: "stale-from-the-secret",
				VT_METRICS_TOKEN_FILE: writeSecret("fresh", "from-the-mount"),
			});

			expect(config.metricsToken).toBe("from-the-mount");
		});

		it("reads an empty file as an unset value", () => {
			const config = parseConfig({
				...baseEnv(),
				VT_METRICS_TOKEN: "stale-from-the-secret",
				VT_METRICS_TOKEN_FILE: writeSecret("empty", "\n"),
			});

			expect(config.metricsToken).toBeUndefined();
		});

		it("throws when the path cannot be read", () => {
			expect(() =>
				parseConfig({
					...baseEnv(),
					VT_METRICS_TOKEN_FILE: join(directory, "does-not-exist"),
				}),
			).toThrowError(/could not be read/);
		});

		it("applies to a required key as well", () => {
			const config = parseConfig({
				VT_POSTGRES_URL_FILE: writeSecret(
					"url",
					"postgres://virtool@db:5432/virtool\n",
				),
				VT_STORAGE_BACKEND: "s3",
				VT_STORAGE_S3_BUCKET: "virtool",
			});

			expect(config.postgresUrl).toBe("postgres://virtool@db:5432/virtool");
		});
	});

	/**
	 * The resolver walks `KEYS`, so a key `parseConfig` reads but nobody added to
	 * that list silently loses its `<KEY>_FILE` variant: it still works from a
	 * plain environment, and a deployment that mounts it as a file gets the
	 * default instead. Nothing in the type system says a word, because `resolved`
	 * is a `NodeJS.ProcessEnv`.
	 */
	describe("KEYS covers every key parseConfig reads", () => {
		const { declared, read } = readKeysFromSource(SOURCE);

		it("finds the declaration and the reads", () => {
			expect(declared.length).toBeGreaterThan(0);
			expect(read.length).toBeGreaterThan(0);
		});

		it("declares every key that is read", () => {
			expect([...read].sort()).toEqual([...declared].sort());
		});

		it("prefixes every key with VT_", () => {
			for (const key of declared) {
				expect(key.startsWith("VT_")).toBe(true);
			}
		});

		it("names every declared key in one of the maximal environments", () => {
			expect(
				[
					...new Set([...Object.keys(S3_ENV), ...Object.keys(AZURE_ENV)]),
				].sort(),
			).toEqual([...declared].sort());
		});

		// The load-bearing pair. Each maximal environment sets every key to a value
		// that differs from its default, so a key the resolver never walked comes
		// back as its default from the file-backed parse and the two configs
		// disagree.
		it.each([
			["s3", S3_ENV],
			["azure", AZURE_ENV],
		])("resolves every %s key from its file variant", (_, env) => {
			expect(parseConfig(asFileBacked(env))).toEqual(parseConfig(env));
		});
	});
});
