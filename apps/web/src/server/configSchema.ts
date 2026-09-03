import { resolveFileBacked } from "@virtool/contracts/env";
import type { StorageConfig } from "@virtool/storage";
import { z } from "zod";

/** postgres-js pool size when `VT_POSTGRES_POOL_MAX` is unset. */
const DEFAULT_POSTGRES_POOL_MAX = 10;

/** How many blocks a chunked upload PUTs at once when unconfigured. */
const DEFAULT_UPLOADS_CHUNKED_CONCURRENCY = 8;

/** The shortest `VT_AUTH_SECRET` accepted, in characters. */
const MINIMUM_AUTH_SECRET_LENGTH = 32;

const INSECURE_ORIGIN_HOSTS: ReadonlySet<string> = new Set(["localhost"]);

/** Server-side configuration parsed from process.env. */
export type ServerConfig = {
	postgresUrl: string;
	postgresPoolMax: number;
	publicOrigin: string;
	webauthnRpId: string;
	authSecret: string;
	metricsToken: string | undefined;
	/**
	 * Server-side Sentry DSN.
	 *
	 * Parsed here rather than read by `@virtool/sentry`'s `readDsn`, which goes
	 * straight to `process.env` and so would miss a `VT_SENTRY_DSN_FILE` mount.
	 * The browser DSN is a separate value baked in at build time by Vite and
	 * cannot be file-backed at all.
	 */
	sentryDsn: string | undefined;
	/** Active key for encrypting secrets stored by Virtool. */
	encryptionKey: string | undefined;
	/** Previous encryption key accepted during rotation. */
	encryptionKeyPrevious: string | undefined;
	storage: StorageConfig;
	/**
	 * How a file download route answers. `stream` sends the bytes through this
	 * server; `redirect` mints a short-lived presigned URL and 302s the client
	 * straight to storage, offloading the transfer. `redirect` falls back to
	 * streaming when the backend cannot presign.
	 */
	downloadMode: "stream" | "redirect";
	/**
	 * The global feature flag for chunked direct-to-blob uploads. When set — and
	 * the storage backend can presign uploads — the client uploads files to
	 * storage in blocks instead of streaming them through this server. Unset
	 * keeps every upload on the proxied `POST /uploads` route, which is the
	 * rollback path.
	 */
	uploadsChunked: boolean;
	/**
	 * How many blocks a chunked upload PUTs at once. Higher values raise
	 * throughput on a high-latency path at the cost of more concurrent requests.
	 * The server passes it to the client at upload init.
	 */
	uploadsChunkedConcurrency: number;
};

const ServerEnv = z.object({
	VT_POSTGRES_URL: z.string().url(),
	// Deployment tooling routinely injects an empty string for a value it has
	// nothing to put in; treat that as unset so the default applies rather than
	// coercing "" to 0 and failing the `.positive()` check at startup.
	VT_POSTGRES_POOL_MAX: z.preprocess(
		(value) => (value === "" ? undefined : value),
		z.coerce.number().int().positive().optional(),
	),
	VT_PUBLIC_ORIGIN: z.string().min(1),
	VT_AUTH_SECRET: z.string().min(MINIMUM_AUTH_SECRET_LENGTH, {
		message: `VT_AUTH_SECRET must be at least ${MINIMUM_AUTH_SECRET_LENGTH} characters`,
	}),
	// Gates the Prometheus scrape endpoint. Unset — or empty, which deployment
	// tooling injects for a value it has nothing to put in — leaves `/metrics`
	// returning 404, so upgrading never starts exposing internals by surprise.
	VT_METRICS_TOKEN: z.preprocess(
		(value) => (value === "" ? undefined : value),
		z.string().optional(),
	),
	// Listed here so it picks up the `<KEY>_FILE` resolution every other key
	// gets. Unset — or empty, which deployment tooling injects — disables Sentry.
	VT_SENTRY_DSN: z.preprocess(
		(value) => (value === "" ? undefined : value),
		z.string().optional(),
	),
	VT_ENCRYPTION_KEY: z.preprocess(
		(value) => (value === "" ? undefined : value),
		z.string().optional(),
	),
	VT_ENCRYPTION_KEY_PREVIOUS: z.preprocess(
		(value) => (value === "" ? undefined : value),
		z.string().optional(),
	),
	VT_STORAGE_BACKEND: z.enum(["s3", "azure"]),
	VT_STORAGE_S3_BUCKET: z.string().optional(),
	VT_STORAGE_S3_REGION: z.string().optional(),
	VT_STORAGE_S3_ENDPOINT: z.string().optional(),
	VT_STORAGE_S3_ACCESS_KEY_ID: z.string().optional(),
	VT_STORAGE_S3_SECRET_ACCESS_KEY: z.string().optional(),
	VT_STORAGE_AZURE_ACCOUNT: z.string().optional(),
	VT_STORAGE_AZURE_CONTAINER: z.string().optional(),
	VT_STORAGE_AZURE_ACCESS_KEY: z.string().optional(),
	VT_STORAGE_AZURE_ENDPOINT: z.string().optional(),
	// A malformed value here would otherwise reach `new URL()` at download time
	// and fail every affected download; validate it at startup instead.
	VT_STORAGE_AZURE_DOWNLOAD_URL: z.preprocess(
		(value) => (value === "" ? undefined : value),
		z.string().url().optional(),
	),
	// The Front Door origin chunked uploads PUT their blocks to. As with the
	// download URL, a malformed value would reach `new URL()` at upload time, so
	// validate it at startup.
	VT_STORAGE_AZURE_UPLOAD_URL: z.preprocess(
		(value) => (value === "" ? undefined : value),
		z.string().url().optional(),
	),
	// Unset — or empty, which deployment tooling injects — keeps downloads
	// streaming through this server.
	VT_STORAGE_DOWNLOAD_MODE: z.preprocess(
		(value) => (value === "" ? undefined : value),
		z.enum(["stream", "redirect"]).default("stream"),
	),
	// The chunked-upload feature flag. `1`, `true`, or `yes` turns it on; unset —
	// or empty, which deployment tooling injects — leaves it off, so an upgrade
	// never switches upload paths by surprise. Rollback is unsetting it.
	VT_UPLOADS_CHUNKED: z.preprocess(
		(value) => (value === "" ? undefined : value),
		z
			.enum(["0", "1", "true", "false", "yes", "no"])
			.optional()
			.transform(
				(value) => value === "1" || value === "true" || value === "yes",
			),
	),
	// How many blocks a chunked upload PUTs at once. Unset — or empty, which
	// deployment tooling injects — applies the default.
	VT_UPLOADS_CHUNKED_CONCURRENCY: z.preprocess(
		(value) => (value === "" ? undefined : value),
		z.coerce.number().int().positive().optional(),
	),
});

// Unset and empty are the same thing for storage variables. Deployment tooling
// routinely injects an empty string for a value it has nothing to put in, and
// an empty access key must fall back to the credential chain rather than be
// sent as a literal empty credential.
function present(value: string | undefined): string | undefined {
	return value ? value : undefined;
}

/** A storage configuration, or the issues that stopped one being built. */
type StorageResult = {
	config: StorageConfig | undefined;
	issues: z.core.$ZodIssue[];
};

type PublicOriginResult = {
	url: URL | undefined;
	issues: z.core.$ZodIssue[];
};

function requiredIssue(key: string, backend: string): z.core.$ZodIssue {
	return {
		code: "custom",
		path: [key],
		message: `${key} is required when VT_STORAGE_BACKEND=${backend}`,
		input: undefined,
	};
}

function parsePublicOrigin(env: NodeJS.ProcessEnv): PublicOriginResult {
	function reject(message: string): PublicOriginResult {
		return {
			url: undefined,
			issues: [
				{
					code: "custom",
					path: ["VT_PUBLIC_ORIGIN"],
					message: `VT_PUBLIC_ORIGIN ${message}`,
					input: undefined,
				},
			],
		};
	}

	let url: URL;

	try {
		url = new URL(env.VT_PUBLIC_ORIGIN ?? "");
	} catch {
		return reject("must be an absolute URL, such as https://virtool.example");
	}

	if (url.protocol !== "https:" && url.protocol !== "http:") {
		return reject("must use http or https");
	}

	if (url.username || url.password) {
		return reject("must not contain credentials");
	}

	if (url.search || url.hash) {
		return reject("must not contain a query string or fragment");
	}

	if (url.pathname !== "/") {
		return reject("must not contain a path");
	}

	if (url.protocol === "http:" && !INSECURE_ORIGIN_HOSTS.has(url.hostname)) {
		return reject(
			`must use https outside ${[...INSECURE_ORIGIN_HOSTS].join(", ")}`,
		);
	}

	return { url, issues: [] };
}

/**
 * Validate the variables the chosen backend needs and assemble its config.
 *
 * Runs against the resolved environment rather than inside a schema transform.
 * Zod skips a transform once any field has failed, so a malformed
 * `VT_POSTGRES_URL` would hide every storage issue and cost the operator a
 * restart to see the next one.
 */
function buildStorage(env: NodeJS.ProcessEnv): StorageResult {
	const issues: z.core.$ZodIssue[] = [];

	if (env.VT_STORAGE_BACKEND === "s3") {
		const bucket = present(env.VT_STORAGE_S3_BUCKET);
		const accessKeyId = present(env.VT_STORAGE_S3_ACCESS_KEY_ID);
		const secretAccessKey = present(env.VT_STORAGE_S3_SECRET_ACCESS_KEY);

		if (!bucket) {
			issues.push(requiredIssue("VT_STORAGE_S3_BUCKET", "s3"));
		}

		// Both empty means the AWS credential chain supplies an IAM role. Exactly
		// one set is always a mistake, and silently ignoring the odd one out would
		// send the process to production authenticating as the wrong principal.
		if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
			issues.push({
				code: "custom",
				path: ["VT_STORAGE_S3_ACCESS_KEY_ID"],
				message:
					"VT_STORAGE_S3_ACCESS_KEY_ID and VT_STORAGE_S3_SECRET_ACCESS_KEY must be set together, or both left empty to use IAM role credentials",
				input: undefined,
			});
		}

		if (!bucket || issues.length > 0) {
			return { config: undefined, issues };
		}

		return {
			config: {
				kind: "s3",
				bucket,
				region: present(env.VT_STORAGE_S3_REGION),
				// Left unset for real AWS, which the SDK resolves from the region.
				endpoint: present(env.VT_STORAGE_S3_ENDPOINT),
				accessKeyId,
				secretAccessKey,
			},
			issues,
		};
	}

	// A missing or unrecognised backend is the base schema's issue to report,
	// and leaves no branch to validate here.
	if (env.VT_STORAGE_BACKEND !== "azure") {
		return { config: undefined, issues };
	}

	const account = present(env.VT_STORAGE_AZURE_ACCOUNT);
	const container = present(env.VT_STORAGE_AZURE_CONTAINER);

	if (!account) {
		issues.push(requiredIssue("VT_STORAGE_AZURE_ACCOUNT", "azure"));
	}

	if (!container) {
		issues.push(requiredIssue("VT_STORAGE_AZURE_CONTAINER", "azure"));
	}

	if (!account || !container) {
		return { config: undefined, issues };
	}

	return {
		config: {
			kind: "azure",
			account,
			container,
			accessKey: present(env.VT_STORAGE_AZURE_ACCESS_KEY),
			endpoint: present(env.VT_STORAGE_AZURE_ENDPOINT),
			downloadUrl: present(env.VT_STORAGE_AZURE_DOWNLOAD_URL),
			uploadUrl: present(env.VT_STORAGE_AZURE_UPLOAD_URL),
		},
		issues,
	};
}

// Every key also accepts a `<KEY>_FILE` variant naming a file to read the value
// from. The resolver is shared with `apps/internal` through
// `@virtool/contracts/env` rather than copied, so the precedence rule — the
// file wins over a plain variable of the same name — cannot drift between the
// two services.
//
// The base schema and the storage checks both run against the resolved
// environment before either result is used, so one report names every offending
// key instead of one per restart.
export function parseServerConfig(
	env: NodeJS.ProcessEnv = process.env,
): ServerConfig {
	const resolved = resolveFileBacked(Object.keys(ServerEnv.shape), env);
	const parsed = ServerEnv.safeParse(resolved);
	const storage = buildStorage(resolved);
	const publicOrigin = parsePublicOrigin(resolved);

	if (!parsed.success || !storage.config || !publicOrigin.url) {
		throw new z.ZodError([
			...(parsed.success ? [] : parsed.error.issues),
			...storage.issues,
			...publicOrigin.issues,
		]);
	}

	const raw = parsed.data;

	return {
		postgresUrl: raw.VT_POSTGRES_URL,
		postgresPoolMax: raw.VT_POSTGRES_POOL_MAX ?? DEFAULT_POSTGRES_POOL_MAX,
		publicOrigin: publicOrigin.url.origin,
		webauthnRpId: publicOrigin.url.hostname,
		authSecret: raw.VT_AUTH_SECRET,
		metricsToken: raw.VT_METRICS_TOKEN,
		sentryDsn: raw.VT_SENTRY_DSN,
		encryptionKey: raw.VT_ENCRYPTION_KEY,
		encryptionKeyPrevious: raw.VT_ENCRYPTION_KEY_PREVIOUS,
		storage: storage.config,
		downloadMode: raw.VT_STORAGE_DOWNLOAD_MODE,
		uploadsChunked: raw.VT_UPLOADS_CHUNKED,
		uploadsChunkedConcurrency:
			raw.VT_UPLOADS_CHUNKED_CONCURRENCY ?? DEFAULT_UPLOADS_CHUNKED_CONCURRENCY,
	};
}
