import { resolveFileBacked } from "@virtool/contracts/env";
import type { StorageConfig } from "@virtool/storage";
import { z } from "zod";

/** postgres-js pool size when `VT_POSTGRES_POOL_MAX` is unset. */
const DEFAULT_POSTGRES_POOL_MAX = 10;

/** Server-side configuration parsed from process.env. */
export type ServerConfig = {
	postgresUrl: string;
	postgresPoolMax: number;
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
	storage: StorageConfig;
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
});

type StorageEnv = z.infer<typeof ServerEnv>;

const ServerEnvSchema = ServerEnv.transform((raw, ctx) => ({
	postgresUrl: raw.VT_POSTGRES_URL,
	postgresPoolMax: raw.VT_POSTGRES_POOL_MAX ?? DEFAULT_POSTGRES_POOL_MAX,
	metricsToken: raw.VT_METRICS_TOKEN,
	sentryDsn: raw.VT_SENTRY_DSN,
	storage: buildStorage(raw, ctx),
}));

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
	};
}

// Every key also accepts a `<KEY>_FILE` variant naming a file to read the value
// from. The resolver is shared with `apps/jobs-api` through
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
