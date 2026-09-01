import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseServerConfig } from "../config";

const postgresUrl = "postgres://virtool:virtool@localhost:5432/virtool";

const minimalS3 = {
	VT_POSTGRES_URL: postgresUrl,
	VT_STORAGE_BACKEND: "s3",
	VT_STORAGE_S3_BUCKET: "virtool",
} as NodeJS.ProcessEnv;

const minimalAzure = {
	VT_POSTGRES_URL: postgresUrl,
	VT_STORAGE_BACKEND: "azure",
	VT_STORAGE_AZURE_ACCOUNT: "devstoreaccount1",
	VT_STORAGE_AZURE_CONTAINER: "virtool",
} as NodeJS.ProcessEnv;

describe("parseServerConfig", () => {
	it("errors when the postgres url is missing", () => {
		expect(() =>
			parseServerConfig({
				VT_STORAGE_BACKEND: "s3",
				VT_STORAGE_S3_BUCKET: "virtool",
			} as NodeJS.ProcessEnv),
		).toThrow(/VT_POSTGRES_URL/);
	});

	it("errors when the storage backend is missing", () => {
		expect(() =>
			parseServerConfig({ VT_POSTGRES_URL: postgresUrl } as NodeJS.ProcessEnv),
		).toThrow(/VT_STORAGE_BACKEND/);
	});

	it("defaults the postgres pool max when unset", () => {
		expect(parseServerConfig(minimalS3).postgresPoolMax).toBe(10);
	});

	it("treats a blank postgres pool max as unset", () => {
		const config = parseServerConfig({
			...minimalS3,
			VT_POSTGRES_POOL_MAX: "",
		} as NodeJS.ProcessEnv);

		expect(config.postgresPoolMax).toBe(10);
	});

	it("reads the postgres pool max from the environment", () => {
		const config = parseServerConfig({
			...minimalS3,
			VT_POSTGRES_POOL_MAX: "25",
		} as NodeJS.ProcessEnv);

		expect(config.postgresPoolMax).toBe(25);
	});

	it("rejects a non-positive postgres pool max", () => {
		expect(() =>
			parseServerConfig({
				...minimalS3,
				VT_POSTGRES_POOL_MAX: "0",
			} as NodeJS.ProcessEnv),
		).toThrow(/VT_POSTGRES_POOL_MAX/);
	});

	it("rejects the removed local backend", () => {
		expect(() =>
			parseServerConfig({
				VT_POSTGRES_URL: postgresUrl,
				VT_STORAGE_BACKEND: "local",
				VT_STORAGE_LOCAL_PATH: "/var/lib/virtool/storage",
			} as NodeJS.ProcessEnv),
		).toThrow(/VT_STORAGE_BACKEND/);
	});

	describe("s3", () => {
		it("parses without an endpoint, region, or credentials", () => {
			const config = parseServerConfig(minimalS3);

			expect(config.postgresUrl).toBe(postgresUrl);
			expect(config.storage).toEqual({
				kind: "s3",
				bucket: "virtool",
				region: undefined,
				endpoint: undefined,
				accessKeyId: undefined,
				secretAccessKey: undefined,
			});
		});

		it("parses a custom endpoint, region, and credentials", () => {
			const config = parseServerConfig({
				...minimalS3,
				VT_STORAGE_S3_REGION: "garage",
				VT_STORAGE_S3_ENDPOINT: "http://garage:3900",
				VT_STORAGE_S3_ACCESS_KEY_ID: "ak",
				VT_STORAGE_S3_SECRET_ACCESS_KEY: "sk",
			} as NodeJS.ProcessEnv);

			expect(config.storage).toEqual({
				kind: "s3",
				bucket: "virtool",
				region: "garage",
				endpoint: "http://garage:3900",
				accessKeyId: "ak",
				secretAccessKey: "sk",
			});
		});

		it("errors when the bucket is missing", () => {
			expect(() =>
				parseServerConfig({
					VT_POSTGRES_URL: postgresUrl,
					VT_STORAGE_BACKEND: "s3",
				} as NodeJS.ProcessEnv),
			).toThrow(/VT_STORAGE_S3_BUCKET/);
		});

		it("errors when only the access key id is set", () => {
			expect(() =>
				parseServerConfig({
					...minimalS3,
					VT_STORAGE_S3_ACCESS_KEY_ID: "ak",
				} as NodeJS.ProcessEnv),
			).toThrow(/must be set together/);
		});

		it("errors when only the secret access key is set", () => {
			expect(() =>
				parseServerConfig({
					...minimalS3,
					VT_STORAGE_S3_SECRET_ACCESS_KEY: "sk",
				} as NodeJS.ProcessEnv),
			).toThrow(/must be set together/);
		});

		it("treats an empty credential as unset rather than as one of a pair", () => {
			const config = parseServerConfig({
				...minimalS3,
				VT_STORAGE_S3_ACCESS_KEY_ID: "",
				VT_STORAGE_S3_SECRET_ACCESS_KEY: "",
			} as NodeJS.ProcessEnv);

			expect(config.storage).toMatchObject({
				accessKeyId: undefined,
				secretAccessKey: undefined,
			});
		});
	});

	describe("azure", () => {
		it("parses without an access key or endpoint", () => {
			const config = parseServerConfig(minimalAzure);

			expect(config.storage).toEqual({
				kind: "azure",
				account: "devstoreaccount1",
				container: "virtool",
				accessKey: undefined,
				endpoint: undefined,
			});
		});

		it("parses an access key and endpoint override", () => {
			const config = parseServerConfig({
				...minimalAzure,
				VT_STORAGE_AZURE_ACCESS_KEY: "key",
				VT_STORAGE_AZURE_ENDPOINT: "http://azurite:10000/devstoreaccount1",
			} as NodeJS.ProcessEnv);

			expect(config.storage).toEqual({
				kind: "azure",
				account: "devstoreaccount1",
				container: "virtool",
				accessKey: "key",
				endpoint: "http://azurite:10000/devstoreaccount1",
			});
		});

		it("errors when the account is missing", () => {
			expect(() =>
				parseServerConfig({
					VT_POSTGRES_URL: postgresUrl,
					VT_STORAGE_BACKEND: "azure",
					VT_STORAGE_AZURE_CONTAINER: "virtool",
				} as NodeJS.ProcessEnv),
			).toThrow(/VT_STORAGE_AZURE_ACCOUNT/);
		});

		it("errors when the container is missing", () => {
			expect(() =>
				parseServerConfig({
					VT_POSTGRES_URL: postgresUrl,
					VT_STORAGE_BACKEND: "azure",
					VT_STORAGE_AZURE_ACCOUNT: "devstoreaccount1",
				} as NodeJS.ProcessEnv),
			).toThrow(/VT_STORAGE_AZURE_CONTAINER/);
		});
	});

	describe("metrics token", () => {
		it("reads the token from the environment", () => {
			const config = parseServerConfig({
				...minimalS3,
				VT_METRICS_TOKEN: "secret",
			} as NodeJS.ProcessEnv);

			expect(config.metricsToken).toBe("secret");
		});

		it("treats a blank token as unset", () => {
			const config = parseServerConfig({
				...minimalS3,
				VT_METRICS_TOKEN: "",
			} as NodeJS.ProcessEnv);

			expect(config.metricsToken).toBeUndefined();
		});
	});

	describe("chunked uploads", () => {
		it("defaults the concurrency when unset", () => {
			expect(parseServerConfig(minimalS3).uploadsChunkedConcurrency).toBe(8);
		});

		it("treats a blank concurrency as unset", () => {
			const config = parseServerConfig({
				...minimalS3,
				VT_UPLOADS_CHUNKED_CONCURRENCY: "",
			} as NodeJS.ProcessEnv);

			expect(config.uploadsChunkedConcurrency).toBe(8);
		});

		it("reads the concurrency from the environment", () => {
			const config = parseServerConfig({
				...minimalS3,
				VT_UPLOADS_CHUNKED_CONCURRENCY: "12",
			} as NodeJS.ProcessEnv);

			expect(config.uploadsChunkedConcurrency).toBe(12);
		});

		it("rejects a non-positive concurrency", () => {
			expect(() =>
				parseServerConfig({
					...minimalS3,
					VT_UPLOADS_CHUNKED_CONCURRENCY: "0",
				} as NodeJS.ProcessEnv),
			).toThrow(/VT_UPLOADS_CHUNKED_CONCURRENCY/);
		});
	});

	describe("file-backed values", () => {
		let directory: string;

		function write(name: string, contents: string): string {
			const path = join(directory, name);
			writeFileSync(path, contents);

			return path;
		}

		beforeAll(() => {
			directory = mkdtempSync(join(tmpdir(), "vt-config-"));
		});

		afterAll(() => {
			rmSync(directory, { force: true, recursive: true });
		});

		it("reads a value from the file the _FILE variant names", () => {
			const config = parseServerConfig({
				...minimalS3,
				VT_METRICS_TOKEN_FILE: write("metrics-token", "from-file"),
			} as NodeJS.ProcessEnv);

			expect(config.metricsToken).toBe("from-file");
		});

		it("resolves both encryption keys from mounted files", () => {
			const config = parseServerConfig({
				...minimalS3,
				VT_ENCRYPTION_KEY_FILE: write("encryption-key", "active"),
				VT_ENCRYPTION_KEY_PREVIOUS_FILE: write(
					"previous-encryption-key",
					"previous",
				),
			} as NodeJS.ProcessEnv);

			expect(config.encryptionKey).toBe("active");
			expect(config.encryptionKeyPrevious).toBe("previous");
		});

		it("strips the trailing newline a mounted secret carries", () => {
			const config = parseServerConfig({
				...minimalS3,
				VT_METRICS_TOKEN_FILE: write("trailing-newline", "  from-file\n"),
			} as NodeJS.ProcessEnv);

			expect(config.metricsToken).toBe("from-file");
		});

		it("prefers the file over a stale plain variable", () => {
			const config = parseServerConfig({
				...minimalS3,
				VT_METRICS_TOKEN: "stale",
				VT_METRICS_TOKEN_FILE: write("preferred", "fresh"),
			} as NodeJS.ProcessEnv);

			expect(config.metricsToken).toBe("fresh");
		});

		it("treats an empty file as an unset value", () => {
			const config = parseServerConfig({
				...minimalS3,
				VT_METRICS_TOKEN: "stale",
				VT_METRICS_TOKEN_FILE: write("empty", "\n"),
			} as NodeJS.ProcessEnv);

			expect(config.metricsToken).toBeUndefined();
		});

		it("ignores a blank _FILE variant", () => {
			const config = parseServerConfig({
				...minimalS3,
				VT_METRICS_TOKEN: "from-env",
				VT_METRICS_TOKEN_FILE: "",
			} as NodeJS.ProcessEnv);

			expect(config.metricsToken).toBe("from-env");
		});

		it("applies to every key, not only the metrics token", () => {
			const config = parseServerConfig({
				VT_POSTGRES_URL: postgresUrl,
				VT_STORAGE_BACKEND: "s3",
				VT_STORAGE_S3_BUCKET: "virtool",
				VT_STORAGE_S3_ACCESS_KEY_ID_FILE: write("access-key-id", "ak\n"),
				VT_STORAGE_S3_SECRET_ACCESS_KEY_FILE: write("secret-key", "sk\n"),
			} as NodeJS.ProcessEnv);

			expect(config.storage).toMatchObject({
				accessKeyId: "ak",
				secretAccessKey: "sk",
			});
		});

		it("pairs a file-backed credential with a plain one", () => {
			const config = parseServerConfig({
				...minimalS3,
				VT_STORAGE_S3_ACCESS_KEY_ID: "ak",
				VT_STORAGE_S3_SECRET_ACCESS_KEY_FILE: write("mixed-pair", "sk\n"),
			} as NodeJS.ProcessEnv);

			expect(config.storage).toMatchObject({
				accessKeyId: "ak",
				secretAccessKey: "sk",
			});
		});

		it("errors when the file cannot be read", () => {
			expect(() =>
				parseServerConfig({
					...minimalS3,
					VT_METRICS_TOKEN_FILE: join(directory, "missing"),
				} as NodeJS.ProcessEnv),
			).toThrow(/VT_METRICS_TOKEN_FILE/);
		});
	});
});
