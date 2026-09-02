import { resolveFileBacked } from "@virtool/contracts/env";
import type { StorageConfig } from "@virtool/storage";
import { z } from "zod";

/** postgres-js pool size when `VT_POSTGRES_POOL_MAX` is unset. */
const DEFAULT_POSTGRES_POOL_MAX = 10;

/** How many blocks a chunked upload PUTs at once when unconfigured. */
const DEFAULT_UPLOADS_CHUNKED_CONCURRENCY = 8;

/** The shortest `VT_AUTH_SECRET` accepted, in characters. */
const MINIMUM_AUTH_SECRET_LENGTH = 32;

/**
 * Hosts allowed to serve this instance over plain HTTP.
 *
 * Everywhere else must be HTTPS: WebAuthn refuses a non-secure context, and a
 * session cookie sent in the clear is a session anyone on the path can take.
 * These three are the secure-context exceptions browsers already make, which is
 * what lets local development and the test suite run without a certificate.
 */
const INSECURE_ORIGIN_HOSTS: ReadonlySet<string> = new Set([
	"localhost",
	"127.0.0.1",
	"[::1]",
]);

/** Server-side configuration parsed from process.env. */
export type ServerConfig = {
	postgresUrl: string;
	postgresPoolMax: number;
	/**
	 * The one public origin this instance is reached on, normalized to scheme,
	 * host and port. Better Auth builds its callback URLs from it and WebAuthn
	 * validates ceremony origins against it.
	 *
	 * It is configured rather than inferred from `Host` or the forwarded headers,
	 * because an attacker controls those and WebAuthn's origin check is the only
	 * thing standing between a passkey and the site that phished it.
	 */
	publicOrigin: string;
	/**
	 * The WebAuthn Relying Party ID: the hostname of {@link publicOrigin}.
	 *
	 * Derived rather than configured. A credential is bound to the RP ID it was
	 * registered under, so an RP ID that disagreed with the origin would register
	 * passkeys that never authenticate.
	 */
	webauthnRpId: string;
	/** Signs and encrypts the authentication state Better Auth issues. */
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
	// Validated and normalized by `buildPublicOrigin` below, which is where the
	// scheme, path and credential rules live.
	VT_PUBLIC_ORIGIN: z.string().min(1),
	// Better Auth derives every signing and encryption key it uses from this, so
	// a short value weakens all of them at once.
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

type StorageEnv = z.infer<typeof ServerEnv>;

const ServerEnvSchema = ServerEnv.transform((raw, ctx) => {
	// Parsed once and read twice: the origin Better Auth builds callbacks from
	// and the RP ID WebAuthn validates against are the same value, and deriving
	// the second from the first is what keeps them from ever disagreeing.
	const publicOrigin = parsePublicOrigin(raw, ctx);

	return {
		postgresUrl: raw.VT_POSTGRES_URL,
		postgresPoolMax: raw.VT_POSTGRES_POOL_MAX ?? DEFAULT_POSTGRES_POOL_MAX,
		publicOrigin: publicOrigin ? publicOrigin.origin : z.NEVER,
		// `hostname` rather than `host`: the RP ID is a domain, and a port in it
		// makes every registration fail validation.
		webauthnRpId: publicOrigin ? publicOrigin.hostname : z.NEVER,
		authSecret: raw.VT_AUTH_SECRET,
		metricsToken: raw.VT_METRICS_TOKEN,
		sentryDsn: raw.VT_SENTRY_DSN,
		encryptionKey: raw.VT_ENCRYPTION_KEY,
		encryptionKeyPrevious: raw.VT_ENCRYPTION_KEY_PREVIOUS,
		storage: buildStorage(raw, ctx),
		downloadMode: raw.VT_STORAGE_DOWNLOAD_MODE,
		uploadsChunked: raw.VT_UPLOADS_CHUNKED,
		uploadsChunkedConcurrency:
			raw.VT_UPLOADS_CHUNKED_CONCURRENCY ?? DEFAULT_UPLOADS_CHUNKED_CONCURRENCY,
	};
});

// Unset and empty are the same thing for storage variables. Deployment tooling
// routinely injects an empty string for a value it has nothing to put in, and
// an empty access key must fall back to the credential chain rather than be
// sent as a literal empty credential.
function present(value: string | undefined): string | undefined {
	return value ? value : undefined;
}

function requirePresent(
	ctx: z.RefinementCtx,
	key: keyof StorageEnv,
	value: string | undefined,
	backend: string,
): boolean {
	if (present(value)) {
		return true;
	}

	ctx.addIssue({
		code: "custom",
		path: [key],
		message: `${key} is required when VT_STORAGE_BACKEND=${backend}`,
	});

	return false;
}

/**
 * Parse `VT_PUBLIC_ORIGIN` into a bare origin, or report why it is not one.
 *
 * Anything beyond scheme, host and port is rejected rather than trimmed away. A
 * value carrying a path, a query, a fragment or credentials means whoever set it
 * believed Virtool was mounted somewhere it is not, and silently discarding the
 * extra would leave that belief intact while callbacks and WebAuthn quietly used
 * a different origin.
 */
function parsePublicOrigin(
	raw: StorageEnv,
	ctx: z.RefinementCtx,
): URL | undefined {
	function reject(message: string): undefined {
		ctx.addIssue({
			code: "custom",
			path: ["VT_PUBLIC_ORIGIN"],
			message: `VT_PUBLIC_ORIGIN ${message}`,
		});
		return undefined;
	}

	let url: URL;

	try {
		url = new URL(raw.VT_PUBLIC_ORIGIN);
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

	return url;
}

function buildStorage(raw: StorageEnv, ctx: z.RefinementCtx): StorageConfig {
	if (raw.VT_STORAGE_BACKEND === "s3") {
		const accessKeyId = present(raw.VT_STORAGE_S3_ACCESS_KEY_ID);
		const secretAccessKey = present(raw.VT_STORAGE_S3_SECRET_ACCESS_KEY);

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
			region: present(raw.VT_STORAGE_S3_REGION),
			// Left unset for real AWS, which the SDK resolves from the region.
			endpoint: present(raw.VT_STORAGE_S3_ENDPOINT),
			accessKeyId,
			secretAccessKey,
		};
	}

	const account = requirePresent(
		ctx,
		"VT_STORAGE_AZURE_ACCOUNT",
		raw.VT_STORAGE_AZURE_ACCOUNT,
		"azure",
	);
	const container = requirePresent(
		ctx,
		"VT_STORAGE_AZURE_CONTAINER",
		raw.VT_STORAGE_AZURE_CONTAINER,
		"azure",
	);

	if (!account || !container) {
		return z.NEVER;
	}

	return {
		kind: "azure",
		account: raw.VT_STORAGE_AZURE_ACCOUNT as string,
		container: raw.VT_STORAGE_AZURE_CONTAINER as string,
		accessKey: present(raw.VT_STORAGE_AZURE_ACCESS_KEY),
		endpoint: present(raw.VT_STORAGE_AZURE_ENDPOINT),
		downloadUrl: present(raw.VT_STORAGE_AZURE_DOWNLOAD_URL),
		uploadUrl: present(raw.VT_STORAGE_AZURE_UPLOAD_URL),
	};
}

// Every key also accepts a `<KEY>_FILE` variant naming a file to read the value
// from. The resolver is shared with `apps/internal` through
// `@virtool/contracts/env` rather than copied, so the precedence rule — the
// file wins over a plain variable of the same name — cannot drift between the
// two services.
export function parseServerConfig(
	env: NodeJS.ProcessEnv = process.env,
): ServerConfig {
	return ServerEnvSchema.parse(
		resolveFileBacked(Object.keys(ServerEnv.shape), env),
	);
}

export const config: ServerConfig = parseServerConfig();
