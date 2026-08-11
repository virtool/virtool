import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseTasksConfig, TASKS_ENV_KEYS } from "./config";

let directory: string;

beforeAll(() => {
	directory = mkdtempSync(join(tmpdir(), "virtool-tasks-config-"));
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

/** The smallest environment that parses, for a test to add one key to. */
function baseEnv(): NodeJS.ProcessEnv {
	return {
		VT_POSTGRES_URL: "postgres://virtool:virtool@localhost:5432/virtool",
		VT_STORAGE_BACKEND: "s3",
		VT_STORAGE_S3_BUCKET: "virtool",
	};
}

describe("parseTasksConfig", () => {
	it("prefixes every key it reads with VT_", () => {
		expect(TASKS_ENV_KEYS.length).toBeGreaterThan(0);

		for (const key of TASKS_ENV_KEYS) {
			expect(key.startsWith("VT_")).toBe(true);
		}
	});

	it("parses a minimal environment", () => {
		const config = parseTasksConfig(baseEnv());

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
		const config = parseTasksConfig(baseEnv());

		expect(config.postgresPoolMax).toBe(10);
		expect(config.probePort).toBe(9900);
		expect(config.shutdownTimeout).toBe(40);
		expect(config.drainTimeout).toBe(25);
		expect(config.metricsToken).toBeUndefined();
		expect(config.sentryDsn).toBeUndefined();
	});

	it("throws when a required key is missing", () => {
		expect(() => parseTasksConfig({ VT_STORAGE_BACKEND: "s3" })).toThrowError();
	});

	describe("the drain window", () => {
		// The drain is a share of the shutdown budget, and the controller silently
		// takes the smaller of the two — so a drain set past the budget would
		// quietly become a shorter one with nothing to say so.
		it("rejects a drain the shutdown budget cannot hold", () => {
			expect(() =>
				parseTasksConfig({
					...baseEnv(),
					VT_TASKS_SHUTDOWN_TIMEOUT: "20",
					VT_TASKS_DRAIN_TIMEOUT: "20",
				}),
			).toThrowError(/must be less than VT_TASKS_SHUTDOWN_TIMEOUT/);
		});

		it("accepts a drain inside it", () => {
			const config = parseTasksConfig({
				...baseEnv(),
				VT_TASKS_SHUTDOWN_TIMEOUT: "20",
				VT_TASKS_DRAIN_TIMEOUT: "10",
			});

			expect(config.shutdownTimeout).toBe(20);
			expect(config.drainTimeout).toBe(10);
		});
	});

	describe("<KEY>_FILE resolution", () => {
		it("reads the value from the named file", () => {
			const config = parseTasksConfig({
				...baseEnv(),
				VT_METRICS_TOKEN_FILE: writeSecret("token", "a-metrics-token"),
			});

			expect(config.metricsToken).toBe("a-metrics-token");
		});

		// The CSI driver's file mount carries whatever the secret store had,
		// trailing newline included. An untrimmed token never matches.
		it("trims the file's contents", () => {
			const config = parseTasksConfig({
				...baseEnv(),
				VT_METRICS_TOKEN_FILE: writeSecret("padded", "  a-metrics-token\n"),
			});

			expect(config.metricsToken).toBe("a-metrics-token");
		});

		// A rollout moving to the mount can still carry the stale env var from the
		// Secret it replaces. Erroring on the overlap would crashloop the very
		// rollout that fixes it.
		it("lets the file win over a plain variable of the same name", () => {
			const config = parseTasksConfig({
				...baseEnv(),
				VT_METRICS_TOKEN: "stale-from-the-secret",
				VT_METRICS_TOKEN_FILE: writeSecret("fresh", "from-the-mount"),
			});

			expect(config.metricsToken).toBe("from-the-mount");
		});

		it("throws when the path cannot be read", () => {
			expect(() =>
				parseTasksConfig({
					...baseEnv(),
					VT_METRICS_TOKEN_FILE: join(directory, "does-not-exist"),
				}),
			).toThrowError(/could not be read/);
		});

		it("reads an empty file as an unset value", () => {
			const config = parseTasksConfig({
				...baseEnv(),
				VT_METRICS_TOKEN_FILE: writeSecret("empty", "\n"),
			});

			expect(config.metricsToken).toBeUndefined();
		});

		it("applies to a required key as well", () => {
			const config = parseTasksConfig({
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

	describe("storage", () => {
		it("rejects an S3 access key id without its secret", () => {
			expect(() =>
				parseTasksConfig({
					...baseEnv(),
					VT_STORAGE_S3_ACCESS_KEY_ID: "an-id",
				}),
			).toThrowError(/must be set together/);
		});

		it("accepts both S3 credentials together", () => {
			const config = parseTasksConfig({
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

		it("requires the azure container when the backend is azure", () => {
			expect(() =>
				parseTasksConfig({
					VT_POSTGRES_URL: "postgres://virtool@db:5432/virtool",
					VT_STORAGE_BACKEND: "azure",
					VT_STORAGE_AZURE_ACCOUNT: "an-account",
				}),
			).toThrowError(/VT_STORAGE_AZURE_CONTAINER/);
		});
	});
});
